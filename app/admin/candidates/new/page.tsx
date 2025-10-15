// app/admin/candidates/new/page.tsx
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { buildCandidateBlocks, toSlug } from "@/lib/server/candidate-seed";
import { ensureShortLink } from "@/lib/server/shortener";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

const FormSchema = z.object({
  name: z.string().min(2),
  office: z.string().min(2),
  city: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/i).optional(),
  photoUrl: z.string().url().optional().or(z.literal("")),
});

async function createCandidate(formData: FormData) {
  "use server";

  const raw = {
    name: (formData.get("name") || "").toString(),
    office: (formData.get("office") || "").toString(),
    city: (formData.get("city") || "").toString(),
    slug: (formData.get("slug") || "").toString(),
    photoUrl: (formData.get("photoUrl") || "").toString(),
  };

  const parsed = FormSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Invalid input: " + JSON.stringify(parsed.error.flatten().fieldErrors));
  }

  const { name, office, city, photoUrl } = parsed.data;
  const slug = parsed.data.slug && parsed.data.slug.trim() ? toSlug(parsed.data.slug) : toSlug(name);

  // service-role client so RLS doesn't block short_links inserts
  const supabase = await getServerSupabase({ serviceRole: true });

  // 1) Upsert candidate
  {
    const { error } = await supabase
      .from("candidates")
      .upsert({ slug, name, office, city, photo_url: photoUrl || null }, { onConflict: "slug" });
    if (error) throw error;
  }

  // 2) Build page (without shortUrl)
  let pageJson = buildCandidateBlocks({
    name, office, city, photoUrl, baseUrl: PUBLIC_BASE_URL, slug,
  });

  // 3) Mint short link (writes long_url/id), inject once
  const longUrl = `${PUBLIC_BASE_URL}/candidate/${slug}`;
  let shortUrl: string;
  try {
    shortUrl = await ensureShortLink(longUrl, slug, supabase, { candidateSlug: slug });
  } catch (e: any) {
    throw new Error(`Ensure short link failed: ${e?.message || String(e)}`);
  }

  pageJson.blocks = pageJson.blocks.map((b: any) =>
    b?.type === "candidate_hero"
      ? { ...b, content: { ...(b.content || {}), shortUrl } }
      : b,
  );

  // 4) Upsert candidate page
  {
    const { error } = await supabase
      .from("candidate_pages")
      .upsert({ slug, blocks: pageJson }, { onConflict: "slug" });
    if (error) throw error;
  }

  // 5) Revalidate and redirect
  revalidatePath(`/admin/short-links`);
  revalidatePath(`/candidate/${slug}`);
  redirect(`/candidate/${slug}`);
}

export default async function NewCandidatePage() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">New Candidate</h1>
      <p className="mt-1 text-sm text-gray-600">
        Create the page, mint a short link, and seed default content.
      </p>

      <form action={createCandidate} className="mt-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            Name
            <input name="name" required className="mt-1 w-full rounded border px-3 py-2" placeholder="Alex Rivera" />
          </label>
          <label className="text-sm">
            Office
            <input name="office" required className="mt-1 w-full rounded border px-3 py-2" placeholder="School Board, District 3" />
          </label>
          <label className="text-sm">
            City
            <input name="city" required className="mt-1 w-full rounded border px-3 py-2" placeholder="Renton, WA" />
          </label>
          <label className="text-sm">
            Custom Slug (optional)
            <input name="slug" className="mt-1 w-full rounded border px-3 py-2" placeholder="alex-rivera" />
          </label>
          <label className="text-sm md:col-span-2">
            Headshot URL (optional)
            <input name="photoUrl" className="mt-1 w-full rounded border px-3 py-2" placeholder="https://.../headshot.jpg" />
          </label>
        </div>

        <div className="flex gap-2">
          <button type="submit" className="rounded bg-gray-900 px-4 py-2 text-white hover:bg-black">Create</button>
          <a href="/admin/short-links" className="rounded border px-4 py-2 hover:bg-gray-50">Short Links</a>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          Pages publish to <code>/candidate/&lt;slug&gt;</code>. Short links redirect via <code>/c/&lt;code&gt;</code>.
        </p>
      </form>
    </div>
  );
}
