"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import WorkOrdersListView from "./WorkOrdersListView";
import WorkOrderDetailView from "./WorkOrderDetailView";
import WorkOrdersKanbanView from "./WorkOrdersKanbanView";
import NewWorkOrderModal from "./NewWorkOrderModal";

export default function WorkOrdersPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);

  useEffect(() => {
    const orderIdParam = searchParams.get("order_id");
    if (orderIdParam) {
      const oid = parseInt(orderIdParam, 10);
      if (!isNaN(oid)) {
        setSelectedOrderId(oid);
      }
    } else {
      setSelectedOrderId(null);
    }
  }, [searchParams]);

  const handleNavigateOrderDetail = (orderId: number) => {
    setSelectedOrderId(orderId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("order_id", String(orderId));
    router.push(`/work-orders?${params.toString()}`);
  };

  const handleBackFromDetail = () => {
    const returnTo = searchParams.get("return_to");
    const isSafeInternalReturn =
      typeof returnTo === "string" &&
      returnTo.startsWith("/") &&
      !returnTo.startsWith("//") &&
      !returnTo.includes("://");

    if (isSafeInternalReturn) {
      router.push(returnTo);
      return;
    }

    setSelectedOrderId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("order_id");
    params.delete("return_to");
    const newQuery = params.toString();
    router.push(newQuery ? `/work-orders?${newQuery}` : "/work-orders");
  };

  return (
    <div className="max-w-[1440px] mx-auto space-y-6">
      {selectedOrderId ? (
        <WorkOrderDetailView ordenId={selectedOrderId} onBack={handleBackFromDetail} />
      ) : viewMode === "kanban" ? (
        <WorkOrdersKanbanView
          onViewDetail={(oid: number) => handleNavigateOrderDetail(oid)}
          onOpenNewModal={() => setIsNewOrderModalOpen(true)}
          onToggleList={() => setViewMode("list")}
        />
      ) : (
        <WorkOrdersListView
          onViewDetail={(oid: number) => handleNavigateOrderDetail(oid)}
          onOpenNewModal={() => setIsNewOrderModalOpen(true)}
          onToggleKanban={() => setViewMode("kanban")}
        />
      )}

      {/* Global New Work Order Modal */}
      <NewWorkOrderModal
        isOpen={isNewOrderModalOpen}
        onClose={() => setIsNewOrderModalOpen(false)}
        onSuccess={(createdOrderId: number) => {
          setIsNewOrderModalOpen(false);
          if (createdOrderId) {
            handleNavigateOrderDetail(createdOrderId);
          }
        }}
      />
    </div>
  );
}
