import { api } from "@/api";

async function handler(req: Request) {
  return api.fetch(req);
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as DELETE,
  handler as PATCH,
  handler as OPTIONS,
};
