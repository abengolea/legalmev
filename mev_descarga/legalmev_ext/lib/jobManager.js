/**
 * JobManager — Coordinador central del job de exportación.
 * Persiste estado en chrome.storage.local.
 * El background lo usa; el popup consulta al abrir.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'legalmev_export_job';
  const STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    UPLOADING: 'uploading',
    COMPLETED: 'completed',
    FAILED: 'failed',
    INTERRUPTED: 'interrupted',
    CANCELLED: 'cancelled'
  };

  function generateJobId() {
    return 'job_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  }

  function createJob(opts) {
    return {
      jobId: generateJobId(),
      tabId: opts.tabId,
      url: opts.url,
      portal: opts.portal || 'mev',
      status: STATUS.PENDING,
      progress: 0,
      current: 0,
      total: opts.total || 0,
      currentStep: 'starting',
      mensaje: '',
      subtext: '',
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      estimatedSeconds: opts.estimatedSeconds || 0,
      error: null,
      result: null
    };
  }

  async function saveJob(job) {
    if (!job) return;
    job.lastUpdatedAt = Date.now();
    await chrome.storage.local.set({ [STORAGE_KEY]: job });
  }

  async function getJob() {
    const r = await chrome.storage.local.get(STORAGE_KEY);
    return r[STORAGE_KEY] || null;
  }

  async function clearJob() {
    await chrome.storage.local.remove(STORAGE_KEY);
  }

  async function updateProgress(jobId, data) {
    const job = await getJob();
    if (!job || job.jobId !== jobId) return;
    Object.assign(job, {
      status: STATUS.RUNNING,
      progress: data.progreso ?? (data.total ? Math.round((100 * (data.current || 0)) / data.total) : data.progress ?? job.progress),
      current: data.current ?? job.current,
      total: data.total ?? job.total,
      mensaje: data.mensaje ?? job.mensaje,
      subtext: data.subtext ?? job.subtext,
      currentStep: 'collecting'
    });
    await saveJob(job);
  }

  async function setUploading(jobId) {
    const job = await getJob();
    if (!job || job.jobId !== jobId) return;
    job.status = STATUS.UPLOADING;
    job.currentStep = 'uploading';
    job.mensaje = 'Enviando y generando PDF...';
    await saveJob(job);
  }

  async function setCompleted(jobId, result) {
    const job = await getJob();
    if (!job || job.jobId !== jobId) return;
    job.status = STATUS.COMPLETED;
    job.progress = 100;
    job.result = result;
    job.currentStep = 'completed';
    await saveJob(job);
  }

  async function setFailed(jobId, error) {
    const job = await getJob();
    if (!job || job.jobId !== jobId) return;
    job.status = STATUS.FAILED;
    job.error = typeof error === 'string' ? error : (error?.message || 'Error desconocido');
    job.currentStep = 'failed';
    await saveJob(job);
  }

  async function setInterrupted(jobId, reason) {
    const job = await getJob();
    if (!job || job.jobId !== jobId) return;
    job.status = STATUS.INTERRUPTED;
    job.error = reason || 'Procesamiento interrumpido (pestaña cerrada o navegación)';
    job.currentStep = 'interrupted';
    await saveJob(job);
  }

  async function setCancelled(jobId) {
    const job = await getJob();
    if (!job || job.jobId !== jobId) return;
    job.status = STATUS.CANCELLED;
    job.currentStep = 'cancelled';
    await saveJob(job);
  }

  /** Estima segundos. MEV: delays conservadores. PJN: muchas actuaciones + PDFs (extensión usa pausas cortas entre filas).
   * MPBA: OCR por página, ~30 seg/trámite.
   */
  function estimateSeconds(count, portal) {
    if (portal === 'mpba') return Math.max(180, count * 30);
    if (portal === 'pjn') return Math.max(120, Math.ceil(count * 6));
    if (portal === 'salta') return Math.max(90, Math.ceil(count * 4));
    if (portal === 'entrerios') return Math.max(90, Math.ceil(count * 4));
    if (portal === 'tucuman') return Math.max(90, Math.ceil(count * 4));
    return Math.max(20, Math.ceil(count * 1.5));
  }

  if (typeof self !== 'undefined') {
    self.LegalMevJobManager = {
      createJob,
      getJob,
      saveJob,
      clearJob,
      updateProgress,
      setUploading,
      setCompleted,
      setFailed,
      setInterrupted,
      setCancelled,
      estimateSeconds,
      STATUS
    };
  }
})();
