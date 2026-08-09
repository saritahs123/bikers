"use client";
import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { LayoutDashboard, ClipboardList, Plus } from "lucide-react";
import WorkshopDashboardView from "./WorkshopDashboardView";
import ReceptionsListView from "./ReceptionsListView";
import ReceptionDetailView from "./ReceptionDetailView";
import NewReceptionModal from "./NewReceptionModal";

export default function WorkshopModuleContainer() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard' | 'recepciones'
  const [selectedRecepcionId, setSelectedRecepcionId] = useState(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  useEffect(() => {
    const viewParam = searchParams.get("view");
    const actionParam = searchParams.get("action");
    const idParam = searchParams.get("id");

    if (idParam) {
      const id = parseInt(idParam, 10);
      if (!isNaN(id)) {
        setSelectedRecepcionId(id);
        setActiveTab("recepciones");
      }
    } else {
      setSelectedRecepcionId(null);
    }

    // Explicitly toggle modal state based on actionParam
    if (actionParam === "new") {
      setIsNewModalOpen(true);
    } else {
      setIsNewModalOpen(false);
    }

    if (viewParam === "list") {
      setActiveTab("recepciones");
    } else if (viewParam === "dashboard" || (!viewParam && !idParam)) {
      setActiveTab("dashboard");
    }
  }, [searchParams]);

  const handleNavigateDetail = (id) => {
    setSelectedRecepcionId(id);
    setActiveTab("recepciones");
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("id", String(id));
      const newQuery = params.toString();
      const newUrl = window.location.pathname + (newQuery ? `?${newQuery}` : "");
      window.history.replaceState(null, "", newUrl);
    }
  };

  const handleBackFromDetail = () => {
    setSelectedRecepcionId(null);
    if (typeof window !== "undefined" && searchParams.get("id")) {
      const params = new URLSearchParams(window.location.search);
      params.delete("id");
      const newQuery = params.toString();
      const newUrl = window.location.pathname + (newQuery ? `?${newQuery}` : "");
      window.history.replaceState(null, "", newUrl);
    }
  };

  const handleCloseModal = () => {
    setIsNewModalOpen(false);
    if (typeof window !== "undefined" && searchParams.get("action") === "new") {
      const params = new URLSearchParams(window.location.search);
      params.delete("action");
      const newQuery = params.toString();
      const newUrl = window.location.pathname + (newQuery ? `?${newQuery}` : "");
      window.history.replaceState(null, "", newUrl);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto space-y-6">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            Módulo de Taller
            <span className="text-xs font-mono font-medium px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
              Bloque 1 • Recepción
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestión operativa de ingreso de bicicletas, inspección técnica inicial y firma digital del cliente.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => {
              setActiveTab("dashboard");
              setSelectedRecepcionId(null);
              handleCloseModal();
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "dashboard" && !selectedRecepcionId
                ? "bg-slate-800 text-emerald-400 shadow-sm border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Panel Operativo
          </button>

          <button
            onClick={() => {
              setActiveTab("recepciones");
              setSelectedRecepcionId(null);
              handleCloseModal();
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "recepciones" || selectedRecepcionId
                ? "bg-slate-800 text-emerald-400 shadow-sm border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Recepciones
          </button>

          <button
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-medium text-xs rounded-lg transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva Recepción
          </button>
        </div>
      </div>

      {/* Main Container View */}
      {selectedRecepcionId ? (
        <ReceptionDetailView
          recepcionId={selectedRecepcionId}
          onBack={handleBackFromDetail}
        />
      ) : activeTab === "dashboard" ? (
        <WorkshopDashboardView
          onNavigateList={() => setActiveTab("recepciones")}
          onViewDetail={(id) => handleNavigateDetail(id)}
        />
      ) : (
        <ReceptionsListView
          onViewDetail={(id) => handleNavigateDetail(id)}
        />
      )}

      {/* Global New Reception Modal */}
      <NewReceptionModal
        isOpen={isNewModalOpen}
        onClose={handleCloseModal}
        onSuccess={() => {
          handleCloseModal();
          setActiveTab("recepciones");
        }}
      />
    </div>
  );
}
