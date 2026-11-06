"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export async function removeSubscriber(formData: FormData) {
  await requireAdmin();
  const id = z.string().min(1).max(40).safeParse(formData.get("id"));
  if (!id.success) return;
  await db.emailSubscriber.delete({ where: { id: id.data } }).catch(() => null);
  revalidatePath("/admin/customers");
}
