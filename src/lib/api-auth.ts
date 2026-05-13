import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function requireTenant(): Promise<
  | { tenantId: string; isAdmin: boolean; response: null }
  | { tenantId: null; isAdmin: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      tenantId: null,
      isAdmin: false,
      response: NextResponse.json({ error: "Não autenticado" }, { status: 401 }),
    };
  }
  return {
    tenantId: session.user.id,
    isAdmin: session.user.role === "admin",
    response: null,
  };
}

export async function requireAdmin(): Promise<
  | { tenantId: string; response: null }
  | { tenantId: null; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return {
      tenantId: null,
      response: NextResponse.json({ error: "Acesso negado" }, { status: 403 }),
    };
  }
  return { tenantId: session.user.id, response: null };
}
