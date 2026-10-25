"use client";

import { use } from "react";

import { ApplicationDetail } from "@/features/applications/ApplicationDetail";

export default function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ApplicationDetail id={id} />;
}
