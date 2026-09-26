import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.API_URL;
const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const RESPONSE_HEADERS = ["content-type", "content-disposition", "cache-control", "etag", "last-modified"];

function buildBackendUrl(path: string[], request: NextRequest) {
  const baseUrl = BACKEND_URL?.replace(/\/+$/, "");

  if (!baseUrl) {
    throw new Error("API_URL is not configured");
  }

  const url = new URL(`${baseUrl}/api/${path.join("/")}`);
  url.search = request.nextUrl.search;

  return url;
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const url = buildBackendUrl(path, request);
  const headers = new Headers();
  const body =
    METHODS_WITH_BODY.has(request.method) && request.body !== null ? await request.text() : undefined;

  const contentType = request.headers.get("content-type");
  const cookie = request.headers.get("cookie");
  const accept = request.headers.get("accept");
  const csrfToken = request.headers.get("x-csrf-token");
  const dataEnvironmentSwitch = request.headers.get("x-finch-data-environment-switch");

  if (contentType) headers.set("content-type", contentType);
  if (cookie) headers.set("cookie", cookie);
  if (accept) headers.set("accept", accept);
  if (csrfToken) headers.set("x-csrf-token", csrfToken);
  if (dataEnvironmentSwitch) {
    headers.set("x-finch-data-environment-switch", dataEnvironmentSwitch);
  }

  const backendResponse = await fetch(url, {
    method: request.method,
    headers,
    body,
    redirect: "manual",
    cache: "no-store",
  });

  const responseHeaders = new Headers();

  for (const header of RESPONSE_HEADERS) {
    const value = backendResponse.headers.get(header);
    if (value) responseHeaders.set(header, value);
  }

  const setCookies = backendResponse.headers.getSetCookie?.() ?? [];
  for (const setCookie of setCookies) {
    responseHeaders.append("set-cookie", setCookie);
  }

  return new NextResponse(backendResponse.body, {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function OPTIONS(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}
