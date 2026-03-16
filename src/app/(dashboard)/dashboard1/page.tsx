'use client';

import React, { useState, useEffect } from 'react';
import { Bell, FileText, MessageSquare, AlertCircle, CheckCircle, Clock, Gavel, Users, Filter, Download, Plus, Settings, Eye, Zap, Mail, Cog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

const SecretariaJuridicaAI = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [casos, setCasos] = useState<any[]>([]);
  const [borradores, setBorradores] = useState<any[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      const nuevaNotificacion = {
        id: Date.now(),
        tipo: Math.random() > 0.5 ? 'movimiento' : 'vencimiento',
        mensaje: Math.random() > 0.5 
          ? 'Nuevo movimiento detectado en Expte. 12345/2024'
          : 'Vence plazo para contestar demanda en 2 días',
        timestamp: new Date(),
        prioridad: Math.random() > 0.7 ? 'alta' : 'normal'
      };
      setNotifications(prev => [nuevaNotificacion, ...prev.slice(0, 4)]);
    }, 5000);

    setCasos([
      { id: '12345/2024', titulo: 'Divorcio González vs. García', estado: 'En trámite', jurisdiccion: 'CABA', ultimoMovimiento: '2025-08-04', vencimiento: '2025-08-10' },
      { id: '67890/2024', titulo: 'Daños y Perjuicios - Accidente Vial', estado: 'Pendiente contestación', jurisdiccion: 'Buenos Aires', ultimoMovimiento: '2025-08-01', vencimiento: '2025-08-08' },
      { id: '11111/2024', titulo: 'Cobro Ejecutivo - Empresa XYZ', estado: 'Sentencia', jurisdiccion: 'Córdoba', ultimoMovimiento: '2025-08-03', vencimiento: null }
    ]);

    setBorradores([
      { id: 1, tipo: 'Contestación de demanda', caso: '67890/2024', progreso: 85, estado: 'revision' },
      { id: 2, tipo: 'Solicitud de medidas cautelares', caso: '12345/2024', progreso: 60, estado: 'borrador' },
      { id: 3, tipo: 'Recurso de apelación', caso: '11111/2024', progreso: 95, estado: 'listo' }
    ]);

    return () => clearInterval(timer);
  }, []);

  const TabButton = ({ id, icon: Icon, label, isActive, onClick }: {id: string, icon: React.ElementType, label: string, isActive: boolean, onClick: (id: string) => void}) => (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${isActive ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-xl">
                <Gavel className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Secretaria Jurídica AI</h1>
                <p className="text-sm text-gray-600">Panel anterior — <Link href="/dashboard" className="text-blue-600 hover:underline">Volver al nuevo panel</Link></p>
              </div>
            </div>
            <div className="flex items-center space-x-2 bg-gray-100 px-3 py-2 rounded-lg">
              <Users className="h-5 w-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Dr. Juan Pérez</span>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex space-x-4">
            <TabButton id="dashboard" icon={Bell} label="Dashboard" isActive={activeTab === 'dashboard'} onClick={setActiveTab} />
            <TabButton id="casos" icon={Gavel} label="Casos" isActive={activeTab === 'casos'} onClick={setActiveTab} />
            <TabButton id="borradores" icon={FileText} label="Borradores IA" isActive={activeTab === 'borradores'} onClick={setActiveTab} />
            <TabButton id="comunicacion" icon={MessageSquare} label="Comunicación SMS" isActive={activeTab === 'comunicacion'} onClick={setActiveTab} />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center justify-between">
                  <div><p className="text-blue-100">Casos Activos</p><p className="text-3xl font-bold">24</p></div>
                  <Gavel className="h-12 w-12 text-blue-200" />
                </div>
              </div>
              <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center justify-between">
                  <div><p className="text-green-100">Vencimientos Hoy</p><p className="text-3xl font-bold">3</p></div>
                  <Clock className="h-12 w-12 text-green-200" />
                </div>
              </div>
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center justify-between">
                  <div><p className="text-orange-100">Borradores</p><p className="text-3xl font-bold">7</p></div>
                  <FileText className="h-12 w-12 text-orange-200" />
                </div>
              </div>
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center justify-between">
                  <div><p className="text-purple-100">Notificaciones</p><p className="text-3xl font-bold">12</p></div>
                  <MessageSquare className="h-12 w-12 text-purple-200" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <p className="text-gray-600">Este es el panel anterior. Para exportar expedientes MEV/PJN, usá el <Link href="/dashboard" className="text-blue-600 font-medium hover:underline">nuevo panel</Link>.</p>
            </div>
          </div>
        )}
        {activeTab === 'casos' && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expediente</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Caso</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th></tr></thead>
              <tbody className="divide-y divide-gray-200">
                {casos.map((c) => <tr key={c.id}><td className="px-6 py-4 font-medium">{c.id}</td><td className="px-6 py-4">{c.titulo}</td><td className="px-6 py-4"><span className="px-2 py-1 text-xs rounded-full bg-blue-100">{c.estado}</span></td></tr>)}
              </tbody>
            </table>
          </div>
        )}
        {activeTab === 'borradores' && (
          <div className="space-y-4">
            {borradores.map((b) => (
              <div key={b.id} className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="font-semibold">{b.tipo}</h3>
                <p className="text-sm text-gray-600">Expediente: {b.caso} — {b.progreso}%</p>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'comunicacion' && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <MessageSquare className="h-16 w-16 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Comunicación SMS</h3>
            <p className="text-gray-600">Funcionalidad en desarrollo</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default SecretariaJuridicaAI;
