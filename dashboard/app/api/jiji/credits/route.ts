import { forward } from "../_apex";
export const dynamic = "force-dynamic";
export const GET = () => forward("/jiji/credits");
export async function POST(req: Request) {
  return forward("/jiji/credits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await req.text(),
  });
}
