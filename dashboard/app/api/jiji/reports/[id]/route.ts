import { forward } from "../../_apex";
export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!/^\d+$/.test(params.id)) return Response.json({ error: "bad id" }, { status: 400 });
  return forward(`/jiji/reports/${params.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: await req.text(),
  });
}
