import { AigcActor } from "@/server/aigc/types";

const operatorIdPattern = /^[a-zA-Z0-9_.@-]{2,80}$/;

export function actorFromRequest(request: Request): AigcActor {
  const rawId = request.headers.get("x-operator-id")?.trim();
  return {
    id: rawId && operatorIdPattern.test(rawId) ? rawId : "web-operator",
    role: "operator"
  };
}

export function hasDispatchAccess(request: Request) {
  const token = process.env.AIGC_DISPATCH_TOKEN?.trim();
  return Boolean(token && request.headers.get("authorization") === `Bearer ${token}`);
}
