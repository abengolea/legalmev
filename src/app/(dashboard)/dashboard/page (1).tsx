
'use client';

import React, { useState, useEffect } from 'react';
import { Bell, FileText, MessageSquare, Search, Calendar, AlertCircle, CheckCircle, Clock, Gavel, Users, Phone, Mail, Filter, Download, Plus, Settings, Eye, Zap, Link as LinkIcon, ExternalLink, Cog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

const SecretariaJuridicaAI = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [casos, setCasos] = useState<any[]>([]);
  const [borradores, setBorradores] = useState<any[]>([]);


  // Simulación de datos en tiempo real
  useEffect(() => {
    // Simular notificaciones en tiempo real
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

    // Datos iniciales
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
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
        isActive 
          ? 'bg-blue-600 text-white shadow-lg' 
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

  const Dashboard = () => (
    <div className="space-y-6">
      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100">Casos Activos</p>
              <p className="text-3xl font-bold">24</p>
            </div>
            <Gavel className="h-12 w-12 text-blue-200" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100">Vencimientos Hoy</p>
              <p className="text-3xl font-bold">3</p>
            </div>
            <Clock className="h-12 w-12 text-green-200" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100">Borradores Pendientes</p>
              <p className="text-3xl font-bold">7</p>
            </div>
            <FileText className="h-12 w-12 text-orange-200" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100">Notificaciones SMS</p>
              <p className="text-3xl font-bold">12</p>
            </div>
            <MessageSquare className="h-12 w-12 text-purple-200" />
          </div>
        </div>
      </div>

      {/* Notificaciones en tiempo real */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800 flex items-center">
            <Bell className="mr-2 text-blue-600" />
            Notificaciones en Tiempo Real
          </h3>
          <span className="bg-red-100 text-red-800 text-sm px-3 py-1 rounded-full">
            {notifications.length} nuevas
          </span>
        </div>
        
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Esperando notificaciones...</p>
          ) : (
            notifications.map((notif) => (
              <div key={notif.id} className={`flex items-start space-x-3 p-4 rounded-lg ${
                notif.prioridad === 'alta' ? 'bg-red-50 border-l-4 border-red-500' : 'bg-blue-50 border-l-4 border-blue-500'
              }`}>
                <div className={`p-2 rounded-full ${
                  notif.tipo === 'movimiento' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                }`}>
                  {notif.tipo === 'movimiento' ? <FileText size={16} /> : <Clock size={16} />}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{notif.mensaje}</p>
                  <p className="text-sm text-gray-500">{notif.timestamp.toLocaleTimeString()}</p>
                </div>
                {notif.prioridad === 'alta' && (
                  <AlertCircle className="text-red-500" size={20} />
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Integración con sistemas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <Zap className="mr-2 text-yellow-600" />
            Conexiones Activas
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                <div>
                    <span className="font-medium">MEV - SCBA</span>
                    <p className="text-xs text-gray-500">Mesa de Entradas Virtual (Buenos Aires)</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center text-red-600">
                        <AlertCircle size={16} className="mr-1" />
                        Desconectado
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/settings?tab=integrations">
                        <Cog size={14} className="mr-1" /> Gestionar
                      </Link>
                    </Button>
                </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border">
               <div>
                    <span className="font-medium">PJN</span>
                    <p className="text-xs text-gray-500">Poder Judicial de la Nación</p>
                </div>
              <div className="flex items-center text-green-600">
                <CheckCircle size={16} className="mr-1" />
                Conectado
              </div>
            </div>
             <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
               <div>
                    <span className="font-medium">SMS Gateway</span>
                    <p className="text-xs text-gray-500">Notificaciones a Clientes</p>
                </div>
                <div className="flex items-center text-yellow-600">
                    <Clock size={16} className="mr-1" />
                    Sincronizando
                </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <Settings className="mr-2 text-gray-600" />
            IA Asistente - Estado
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Análisis de movimientos</span>
              <span className="text-green-600 font-semibold">Activo</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Generación de borradores</span>
              <span className="text-green-600 font-semibold">Activo</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Alertas automáticas</span>
              <span className="text-green-600 font-semibold">Activo</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Próxima sincronización</span>
              <span className="text-blue-600 font-semibold">5 min</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const CasosView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Gestión de Casos</h2>
        <div className="flex space-x-2">
          <button className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            <Plus size={16} />
            <span>Nuevo Caso</span>
          </button>
          <button className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">
            <Filter size={16} />
            <span>Filtros</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expediente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Caso</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jurisdicción</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vencimiento</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {casos.map((caso) => (
                <tr key={caso.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{caso.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-800">{caso.titulo}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      caso.estado === 'En trámite' ? 'bg-blue-100 text-blue-800' :
                      caso.estado === 'Pendiente contestación' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {caso.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{caso.jurisdiccion}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {caso.vencimiento ? (
                      <span className={`font-medium ${
                        new Date(caso.vencimiento) <= new Date(Date.now() + 2*24*60*60*1000) 
                          ? 'text-red-600' : 'text-gray-800'
                      }`}>
                        {caso.vencimiento}
                      </span>
                    ) : (
                      <span className="text-gray-400">Sin vencimiento</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button className="text-blue-600 hover:text-blue-800">
                        <Eye size={16} />
                      </button>
                      <button className="text-green-600 hover:text-green-800">
                        <MessageSquare size={16} />
                      </button>
                      <button className="text-purple-600 hover:text-purple-800">
                        <FileText size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const BorradoresView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Borradores Automáticos</h2>
        <button className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
          <Plus size={16} />
          <span>Generar Borrador</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {borradores.map((borrador) => (
          <div key={borrador.id} className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">{borrador.tipo}</h3>
                <p className="text-sm text-gray-600">Expediente: {borrador.caso}</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                borrador.estado === 'listo' ? 'bg-green-100 text-green-800' :
                borrador.estado === 'revision' ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {borrador.estado === 'listo' ? 'Listo para enviar' :
                 borrador.estado === 'revision' ? 'En revisión' : 'Borrador'}
              </div>
            </div>
            
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Progreso</span>
                <span className="text-sm font-medium text-gray-700">{borrador.progreso}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    borrador.progreso === 100 ? 'bg-green-600' :
                    borrador.progreso >= 80 ? 'bg-yellow-600' : 'bg-blue-600'
                  }`}
                  style={{ width: `${borrador.progreso}%` }}
                ></div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                <Eye size={16} />
                <span>Revisar</span>
              </button>
              <button className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">
                <Download size={16} />
                <span>Descargar</span>
              </button>
              {borrador.estado === 'listo' && (
                <button className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                  <Mail size={16} />
                  <span>Enviar</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-xl">
                <Gavel className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Secretaria Jurídica AI</h1>
                <p className="text-sm text-gray-600">Asistente automatizado para abogados</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Bell className="h-6 w-6 text-gray-600" />
                {notifications.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2 bg-gray-100 px-3 py-2 rounded-lg">
                <Users className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Dr. Juan Pérez</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex space-x-4">
            <TabButton 
              id="dashboard" 
              icon={Bell} 
              label="Dashboard" 
              isActive={activeTab === 'dashboard'} 
              onClick={setActiveTab} 
            />
            <TabButton 
              id="casos" 
              icon={Gavel} 
              label="Casos" 
              isActive={activeTab === 'casos'} 
              onClick={setActiveTab} 
            />
            <TabButton 
              id="borradores" 
              icon={FileText} 
              label="Borradores IA" 
              isActive={activeTab === 'borradores'} 
              onClick={setActiveTab} 
            />
            <TabButton 
              id="comunicacion" 
              icon={MessageSquare} 
              label="Comunicación SMS" 
              isActive={activeTab === 'comunicacion'} 
              onClick={setActiveTab} 
            />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'casos' && <CasosView />}
        {activeTab === 'borradores' && <BorradoresView />}
        {activeTab === 'comunicacion' && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <MessageSquare className="h-16 w-16 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Comunicación SMS</h3>
            <p className="text-gray-600">Funcionalidad de SMS automático en desarrollo</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default SecretariaJuridicaAI;
