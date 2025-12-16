export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log('[trigger-checkins] Request received at', new Date().toISOString());

  try {
    const body = await req.json().catch(() => ({}));
    const { date } = body;
    
    const targetDate = date || new Date().toISOString().split('T')[0];
    console.log('[trigger-checkins] Target date:', targetDate);

    // Get all AI users - identified by email pattern: ai.*@hivejournal.ai
    console.log('[trigger-checkins] Fetching AI users (email pattern: ai.*@hivejournal.ai)...');
    
    // Fetch all users from auth and filter by email pattern
    const { data: allUsersData, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('[trigger-checkins] Error fetching users from auth:', authError);
      return NextResponse.json(
        { error: 'Failed to fetch users', details: authError.message },
        { status: 500 }
      );
    }

    console.log('[trigger-checkins] Found', allUsersData.users.length, 'total users');

    // Filter for AI users: email starts with "ai." and ends with "@hivejournal.ai"
    const aiUsers = allUsersData.users.filter((user) => {
      const email = user.email || user.user_metadata?.email || '';
      const isAI = email.startsWith('ai.') && email.endsWith('@hivejournal.ai');
      if (isAI) {
        console.log('[trigger-checkins] Found AI user:', email, '(id:', user.id, ')');
      }
      return isAI;
    });

    console.log('[trigger-checkins] Found', aiUsers.length, 'AI users matching pattern');

    const usersToProcess = aiUsers.map((user) => ({ user_id: user.id, email: user.email }));
    console.log('[trigger-checkins] Processing', usersToProcess.length, 'users');

    let checkedIn = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (const user of usersToProcess) {
      try {
        const userId = user.user_id;
        const userEmail = user.email;
        console.log('[trigger-checkins] Processing user:', userId, '(', userEmail, ')');

        // Check if user already checked in today
        const todayStart = new Date(targetDate);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(targetDate);
        todayEnd.setHours(23, 59, 59, 999);

        const { data: existingCheckins, error: checkError } = await supabase
          .from('tracking_checkins')
          .select('id')
          .eq('user_id', userId)
          .gte('checked_at', todayStart.toISOString())
          .lte('checked_at', todayEnd.toISOString());

        if (checkError) {
          console.error('[trigger-checkins] Error checking existing checkins for user', userId, ':', checkError);
          errors++;
          errorDetails.push(`User ${userId}: ${checkError.message}`);
          continue;
        }

        if (existingCheckins && existingCheckins.length > 0) {
          console.log('[trigger-checkins] User', userId, 'already checked in today, skipping');
          skipped++;
          continue;
        }

        // Create check-in
        // Adjust the slug based on your system - this is a placeholder
        const checkinData = {
          user_id: userId,
          slug: 'daily-checkin', // Adjust based on your system
          checked_at: new Date().toISOString(),
        };

        console.log('[trigger-checkins] Creating check-in for user', userId, ':', checkinData);
        // @ts-ignore - Supabase type inference issue with tracking_checkins table
        const { error: insertError } = await supabase
          .from('tracking_checkins')
          .insert([checkinData]);

        if (insertError) {
          console.error('[trigger-checkins] Error inserting check-in for user', userId, ':', insertError);
          errors++;
          errorDetails.push(`User ${userId}: ${insertError.message}`);
          continue;
        }

        console.log('[trigger-checkins] Successfully created check-in for user', userId);
        checkedIn++;
      } catch (userError: any) {
        console.error('[trigger-checkins] Unexpected error processing user:', userError);
        errors++;
        errorDetails.push(`Unexpected error: ${userError.message}`);
      }
    }

    const duration = Date.now() - startTime;
    const result = {
      date: targetDate,
      status: errors === 0 ? 'success' : 'partial',
      checkedIn,
      skipped,
      attempted: usersToProcess.length,
      errors: errors > 0 ? errors : undefined,
      errorDetails: errors > 0 ? errorDetails : undefined,
      duration: `${duration}ms`,
    };

    console.log('[trigger-checkins] Completed in', duration, 'ms:', result);
    return NextResponse.json(result);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('[trigger-checkins] Fatal error after', duration, 'ms:', error);
    return NextResponse.json(
      {
        error: 'Failed to trigger check-ins',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

