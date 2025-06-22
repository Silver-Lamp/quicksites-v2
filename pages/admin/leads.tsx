'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';
import Papa from 'papaparse';
import type { CSVLeadRow, Lead } from '@/types/lead.types';
import { createLeadFromPhoto } from '@/lib/leads/photoProcessor';
import Image from 'next/image';

const CONFIDENCE_THRESHOLD = 0.85;
const LEADS_PER_PAGE = 20;

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    matchedDomains: 0,
    matchedCampaigns: 0,
    duplicates: 0,
  });
  const [nextAction, setNextAction] = useState(false);
  const [error, setError] = useState('');
  const [sortField, setSortField] = useState<'created_at' | 'address_city'>('created_at');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [reviewLead, setReviewLead] = useState<any | null>(null);
  const [reviewImage, setReviewImage] = useState<string | null>(null);
  const [editingLeadId, setEditingLeadId] = useState<number | null>(null);
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const fetchLeads = useCallback(async (reset = false) => {
    setLoading(true);
    let query = supabase
      .from('leads')
      .select('*')
      .order(sortField, { ascending: sortField === 'address_city' });
    if (filterSource !== 'all') query = query.eq('source', filterSource);
    if (filterStatus !== 'all') query = query.eq('status', filterStatus);

    const from = reset ? 0 : page * LEADS_PER_PAGE;
    const to = from + LEADS_PER_PAGE - 1;
    const { data } = await query.range(from, to);

    setLeads((prev) => (reset ? data || [] : [...prev, ...(data || [])]));
    setPage((prev) => (reset ? 1 : prev + 1));
    setLoading(false);
  }, [filterSource, filterStatus, sortField, page]);

  useEffect(() => {
    fetchLeads(true);
  }, [fetchLeads]);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loading) {
        fetchLeads();
      }
    });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [loaderRef.current, loading, fetchLeads]);

  const processFile = async (file: File) => {
    const preview = URL.createObjectURL(file);
    setReviewImage(preview);

    const photoPath = `leads/photos/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('leads')
      .upload(photoPath, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      alert('Failed to upload photo');
      return;
    }

    const photoUrl = supabase.storage.from('leads').getPublicUrl(photoPath).data.publicUrl;

    const { leadData, confidence }: { leadData: any; confidence: number } =
      await createLeadFromPhoto(file);
    leadData.id = crypto.randomUUID();
    leadData.confidence = confidence || 0;
    leadData.photo_url = photoUrl || null;
    leadData.status = 'reviewed';
    leadData.address_street = null;
    leadData.address_zip = null;
    leadData.address_country = null;

    if (confidence >= CONFIDENCE_THRESHOLD) {
      await supabase.from('leads').insert([leadData]);
      fetchLeads();
    } else {
      setReviewLead({ ...leadData, confidence });
    }
  };

  const saveReviewedLead = async () => {
    if (!reviewLead) return;
    const reviewedCopy = { ...reviewLead };
    if (!reviewedCopy.status) reviewedCopy.status = 'needs_review';
    await supabase.from('leads').insert([reviewedCopy]);
    setReviewLead(null);
    setReviewImage(null);
    fetchLeads();
  };

  return (
    <div>
      {/* ... other JSX ... */}
      {reviewLead && reviewImage && (
        <Image
          src={reviewImage}
          alt="Lead preview"
          width={300}
          height={200}
          className="rounded"
        />
      )}
      <a>
        I&apos;m Interested
      </a>
    </div>
  );
}
