"use server";

import { expireAdminStats } from "@/lib/admin-stats-tag";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { applyAction, AssistantActionError, cancelAction, undoAction } from "@/lib/assistant/actions";

export type AssistantActionState = { ok?: boolean; message?: string };

const actionId = z.string().min(1).max(40);

// Pressing "تأكيد" is the only path from a proposal to the catalog.
async function decide(fd: FormData, task: (id: string, admin: string) => Promise<string[] | void>, success: string): Promise<AssistantActionState> {
  const admin = await requireAdmin();
  const id = actionId.safeParse(fd.get("id"));
  if (!id.success) return { ok: false, message: (await adminTr()).tr("طلب غير صالح.", "Invalid request.") };
  let slugs: string[] | void;
  try {
    slugs = await task(id.data, admin.email);
  } catch (e) {
    if (e instanceof AssistantActionError) return { ok: false, message: e.message };
    throw e;
  }
  if (slugs) {
    // updateTag: the next storefront visit already shows the new stock.
    expireAdminStats();
    updateTag("products");
    for (const slug of slugs) updateTag(`product:${slug}`);
    revalidatePath("/admin/products");
    revalidatePath("/admin");
  }
  revalidatePath("/admin/assistant");
  return { ok: true, message: success };
}

export async function confirmAssistantAction(_: AssistantActionState, fd: FormData) {
  return decide(fd, applyAction, (await adminTr()).tr("تسجل.", "Saved."));
}

export async function cancelAssistantAction(_: AssistantActionState, fd: FormData) {
  return decide(fd, cancelAction, (await adminTr()).tr("تلغى.", "Cancelled."));
}

export async function undoAssistantAction(_: AssistantActionState, fd: FormData) {
  return decide(fd, undoAction, (await adminTr()).tr("تم التراجع.", "Undone."));
}
