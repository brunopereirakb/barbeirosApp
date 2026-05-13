import { auth } from "@/auth";
import { NextResponse } from "next/server";

const APP_ROUTES = [
  "/calendario", "/clientes", "/servicos", "/lista-espera",
  "/mensagens", "/estatisticas", "/definicoes",
];

function isAppRoute(pathname: string) {
  return (
    pathname === "/" ||
    APP_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const role = req.auth.user.role;

  // Admins only belong in /admin — redirect away from app pages
  if (role === "admin" && isAppRoute(pathname)) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  // Regular users cannot access /admin
  if (pathname.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/calendario", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!login|register|api/auth|api/register|_next/static|_next/image|favicon\\.ico).*)"],
};
