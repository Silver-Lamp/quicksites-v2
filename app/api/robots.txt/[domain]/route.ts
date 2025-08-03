// app/api/robots.txt/[domain]/route.ts
export function GET(req: Request, { params }: { params: { domain: string } }) {
  return Response.redirect(`https://${params.domain}/robots.txt`, 307);
}
