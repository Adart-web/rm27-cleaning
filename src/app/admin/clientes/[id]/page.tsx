"use client";

import { useParams } from "next/navigation";
import ClienteForm from "@/components/admin/ClienteForm";

export default function EditarClientePage() {
  const params = useParams<{ id: string }>();
  return <ClienteForm clienteId={params.id} />;
}