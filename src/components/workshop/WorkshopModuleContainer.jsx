"use client";
import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { LayoutDashboard, ClipboardList, Wrench, Plus } from "lucide-react";
import WorkshopDashboardView from "./WorkshopDashboardView";
import ReceptionsListView from "./ReceptionsListView";
import ReceptionDetailView from "./ReceptionDetailView";
import NewReceptionModal from "./NewReceptionModal";
import WorkOrdersListView from "./WorkOrdersListView";
import WorkOrdersKanbanView from "./WorkOrdersKanbanView";
import WorkOrderDetailView from "./WorkOrderDetailView";
import NewWorkOrderModal from "./NewWorkOrderModal";

export default function WorkshopModuleContainer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard' | 'recepciones' | 'work_orders' | 'kanban'
  const [selectedRecepcionId, setSelectedRecepcionId] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [isNewReceptionModalOpen, setIsNewReceptionModalOpen] = useState(false);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);

  useEffect(() => {
    const viewParam = searchParams.get("view");
    const actionParam = searchParams.get("action");
    const idParam = searchParams.get("id");
    const orderIdParam = searchParams.get("order_id");

    if (idParam) {
      const id = parseInt(idParam, 10);
      if (!isNaN(id)) {
        setSelectedRecepcionId(id);
        setActiveTab("recepciones");
      }
    } else {
      setSelectedRecepcionId(null);
    }

    if (orderIdParam) {
      const oid = parseInt(orderIdParam, 10);
      if (!isNaN(oid)) {
        setSelectedOrderId(oid);
        setActiveTab("work_orders");
      }
    } else {
      setSelectedOrderId(null);
    }

    // Modal action params
    if (actionParam === "new") {
      setIsNewReceptionModalOpen(true);
    } else if (actionParam === "new_order") {
      setIsNewOrderModalOpen(true);
    } else {
      setIsNewReceptionModalOpen(false);
      setIsNewOrderModalOpen(false);
    }

    if (viewParam === "list") {
      setActiveTab("recepciones");
    } else if (viewParam === "work_orders") {
      setActiveTab("work_orders");
    } else if (viewParam === "kanban") {
      setActiveTab("kanban");
    } else if (viewParam === "dashboard" || (!viewParam && !idParam && !orderIdParam)) {
      setActiveTab("dashboard");
    }
  }, [searchParams]);

  const handleNavigateRecepcionDetail = (id) => {
    setSelectedRecepcionId(id);
    setSelectedOrderId(null);
    setActiveTab("recepciones");
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("id", String(id));
      params.delete("order_id");
      const newQuery = params.toString();
      const newUrl = window.location.pathname + (newQuery ? `?${newQuery}` : "");
      window.history.replaceState(null, "", newUrl);
    }
  };

  const handleNavigateOrderDetail = (orderId) => {
    setSelectedOrderId(orderId);
    setSelectedRecepcionId(null);
    setActiveTab("work_orders");
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("order_id", String(orderId));
      params.delete("id");
      const newQuery = params.toString();
      const newUrl = window.location.pathname + (newQuery ? `?${newQuery}` : "");
      window.history.replaceState(null, "", newUrl);
    }
  };

  const handleBackFromDetail = () => {
    const returnTo = searchParams ? searchParams.get("return_to") : null;
    const isSafeInternalReturn =
      typeof returnTo === "string" &&
      returnTo.startsWith("/") &&
      !returnTo.startsWith("//") &&
      !returnTo.includes("://");

    if (isSafeInternalReturn) {
      router.push(returnTo);
      return;
    }

    setSelectedRecepcionId(null);
    setSelectedOrderId(null);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.delete("id");
      params.delete("order_id");
      params.delete("return_to");
      const newQuery = params.toString();
      const newUrl = window.location.pathname + (newQuery ? `?${newQuery}` : "");
      window.history.replaceState(null, "", newUrl);
    }
  };

  const handleCloseModals = () => {
    setIsNewReceptionModalOpen(false);
    setIsNewOrderModalOpen(false);
    if (typeof window !== "undefined" && searchParams.get("action")) {
      const params = new URLSearchParams(window.location.search);
      params.delete("action");
      const newQuery = params.toString();
      const newUrl = window.location.pathname + (newQuery ? `?${newQuery}` : "");
      window.history.replaceState(null, "", newUrl);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto space-y-6">
      {/* Main Container Views - Single contextual header rendered per view */}

      {/* Main Container Views */}
      {selectedRecepcionId ? (
        <ReceptionDetailView recepcionId={selectedRecepcionId} onBack={handleBackFromDetail} />
      ) : selectedOrderId ? (
        <WorkOrderDetailView ordenId={selectedOrderId} onBack={handleBackFromDetail} />
      ) : activeTab === "dashboard" ? (
        <WorkshopDashboardView
          onNavigateList={() => setActiveTab("recepciones")}
          onNavigateWorkOrders={() => setActiveTab("work_orders")}
          onViewDetail={(id) => handleNavigateRecepcionDetail(id)}
          onViewOrderDetail={(oid) => handleNavigateOrderDetail(oid)}
        />
      ) : activeTab === "recepciones" ? (
        <ReceptionsListView onViewDetail={(id) => handleNavigateRecepcionDetail(id)} />
      ) : activeTab === "kanban" ? (
        <WorkOrdersKanbanView
          onViewDetail={(oid) => handleNavigateOrderDetail(oid)}
          onOpenNewModal={() => setIsNewOrderModalOpen(true)}
          onToggleList={() => setActiveTab("work_orders")}
        />
      ) : (
        <WorkOrdersListView
          onViewDetail={(oid) => handleNavigateOrderDetail(oid)}
          onOpenNewModal={() => setIsNewOrderModalOpen(true)}
          onToggleKanban={() => setActiveTab("kanban")}
        />
      )}

      {/* Global New Reception Modal */}
      <NewReceptionModal
        isOpen={isNewReceptionModalOpen}
        onClose={handleCloseModals}
        onSuccess={(createdData) => {
          const hasOT = Boolean(
            createdData?.orden_trabajo_id ||
            createdData?.data?.orden_trabajo_id
          );
          handleCloseModals();
          if (!hasOT) {
            setActiveTab("recepciones");
          }
        }}
        onCreated={(createdData) => {
          const hasOT = Boolean(
            createdData?.orden_trabajo_id ||
            createdData?.data?.orden_trabajo_id
          );
          handleCloseModals();
          if (!hasOT) {
            setActiveTab("recepciones");
          }
        }}
      />

      {/* Global New Work Order Modal */}
      <NewWorkOrderModal
        isOpen={isNewOrderModalOpen}
        onClose={handleCloseModals}
        onSuccess={(createdOrderId) => {
          handleCloseModals();
          handleNavigateOrderDetail(createdOrderId);
        }}
      />
    </div>
  );
}
