import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/is-admin';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get('tournamentId');

    if (!tournamentId) {
      return NextResponse.json({ error: 'Tournament ID is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Fetch Tournament details
    const { data: tournament, error: tErr } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (tErr || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // 2. Fetch Confirmed Registrations
    const { data: registrations, error: rErr } = await supabase
      .from('registrations')
      .select(`
        id,
        registration_type,
        registered_name_snapshot,
        registered_role_snapshot,
        registered_batting_style_snapshot,
        registered_bowling_style_snapshot,
        registered_jersey_size_snapshot,
        team_name,
        team_owner_id
      `)
      .eq('tournament_id', tournamentId)
      .eq('registration_status', 'CONFIRMED');

    if (rErr) {
      return NextResponse.json({ error: rErr.message }, { status: 500 });
    }

    const isOwnerBased = tournament.tournament_type === 'OWNER_BASED';
    const confirmedList = registrations || [];

    let formattedText = '';

    if (isOwnerBased) {
      // 3. Fetch Teams from team_owners table
      const { data: teamOwners } = await supabase
        .from('team_owners')
        .select('*')
        .eq('tournament_id', tournamentId);

      const teams = teamOwners || [];

      // Build Teams List
      const teamsSection: string[] = [];
      teams.forEach((t: any, index: number) => {
        const numEmoji = `${index + 1}️⃣`;
        const ownerReg = confirmedList.find(
          (r: any) => r.team_owner_id === t.id && (r.registration_type === 'OWNER' || r.registration_type === 'TEAM_OWNER')
        );
        const iconReg = confirmedList.find(
          (r: any) => r.team_owner_id === t.id && (r.registration_type === 'ICON' || r.registration_type === 'ICON_PLAYER')
        );

        const ownerName = ownerReg?.registered_name_snapshot || t.owner_name || 'Pending';
        const iconName = iconReg?.registered_name_snapshot || t.icon_player_name || 'Pending';

        teamsSection.push(
          `${numEmoji} ${t.team_name || `Team ${index + 1}`}\n👑 Owner: ${ownerName}\n⭐ Icon: ${iconName}`
        );
      });

      // Build Auction Pool: Owners & Players
      const ownersList = confirmedList
        .filter((r: any) => r.registration_type === 'OWNER' || r.registration_type === 'TEAM_OWNER')
        .map((r: any, idx: number) => `${idx + 1}. ${r.registered_name_snapshot}`);

      const playersList = confirmedList
        .filter((r: any) => r.registration_type === 'PLAYER' || r.registration_type === 'REGULAR' || !r.registration_type)
        .map((r: any, idx: number) => `${idx + 1}. ${r.registered_name_snapshot}`);

      formattedText = `🏏 ${tournament.name.toUpperCase()}

🏆 REGISTERED TEAMS

${teamsSection.length > 0 ? teamsSection.join('\n\n') : 'No teams confirmed yet.'}


🔥 AUCTION POOL

👑 OWNERS

${ownersList.length > 0 ? ownersList.join('\n') : 'No owners in auction pool yet.'}

🏏 PLAYERS

${playersList.length > 0 ? playersList.join('\n') : 'No regular players in auction pool yet.'}


⭐ ICONS

Icons remain with their registered teams
and are not part of the auction pool.`;
    } else {
      // Non-Owner Tournament Format
      const playersList: string[] = [];
      confirmedList.forEach((r: any, idx: number) => {
        const role = r.registered_role_snapshot || 'Batsman';
        const batting = r.registered_batting_style_snapshot === 'LEFT_HAND' ? 'Left Hand' : 'Right Hand';
        const bowling = r.registered_bowling_style_snapshot ? `\nBowling: ${r.registered_bowling_style_snapshot}` : '';
        const jersey = r.registered_jersey_size_snapshot || 'M';

        playersList.push(
          `${idx + 1}. ${r.registered_name_snapshot}\nRole: ${role}\nBatting: ${batting}${bowling}\nJersey: ${jersey}`
        );
      });

      formattedText = `🏏 ${tournament.name.toUpperCase()}

✅ CONFIRMED PLAYERS

${playersList.length > 0 ? playersList.join('\n\n') : 'No confirmed players yet.'}`;
    }

    return NextResponse.json({
      success: true,
      text: formattedText,
      confirmedCount: confirmedList.length,
    });
  } catch (err: any) {
    const status = err.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ error: err.message || 'WhatsApp export error' }, { status });
  }
}
