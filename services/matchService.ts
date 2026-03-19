import { supabase } from "./supabase";
import { SocialProfile } from "../types";
import { getCurrentUser } from "./auth";

// Helper to handle pgvector format variations ([1,2,3] vs string "[1,2,3]")
const parseVector = (v: any): number[] => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    return v.replace(/[\[\]]/g, '').split(',').map(Number);
  }
  return [0, 0, 0, 0, 0];
};

export const getRecommendedSouls = async (limit: number = 10): Promise<SocialProfile[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  // 1. Get current user's profile to get their scores
  const { data: profile } = await supabase
    .from('profiles')
    .select('radar_scores, gender, interested_in, age')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.radar_scores) return [];

  // 2. Call the RPC function defined in Supabase
  const { data, error } = await supabase.rpc('match_souls', {
    query_scores: profile.radar_scores,
    match_gender: profile.interested_in,
    my_gender: profile.gender,
    min_age: Math.max(18, (profile.age || 25) - 15),
    max_age: (profile.age || 25) + 15,
    match_limit: limit
  });

  if (error) {
    console.error('getRecommendedSouls error:', error);
    return [];
  }

  return (data as any[]).map(d => ({
    id: d.id,
    soulTitle: d.soul_title,
    summary: d.summary,
    radarScores: parseVector(d.radar_scores),
    distance: d.distance,
    idealPartner: d.ideal_partner
  }));
};

export const swipe = async (targetUserId: string, direction: 'like' | 'dislike'): Promise<boolean> => {
  const user = await getCurrentUser();
  if (!user) return false;

  const { error } = await supabase.from('swipes').upsert({
    swiper_id: user.id,
    receiver_id: targetUserId,
    direction
  });

  if (error) {
    console.error('swipe error:', error);
    return false;
  }

  if (direction === 'like') {
    // 1. Check if the other person already liked us
    const { data: theirSwipe } = await supabase
      .from('swipes')
      .select('id')
      .eq('swiper_id', targetUserId)
      .eq('receiver_id', user.id)
      .eq('direction', 'like')
      .maybeSingle();

    if (theirSwipe) {
      // It's a mutual match!
      // 2. Check if a match record already exists
      const { data: existingMatch } = await supabase
        .from('matches')
        .select('id')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${targetUserId}),and(user1_id.eq.${targetUserId},user2_id.eq.${user.id})`)
        .maybeSingle();
      
      if (!existingMatch) {
        // 3. Create the match record explicitly if it wasn't handled by a DB trigger
        const user1_id = user.id < targetUserId ? user.id : targetUserId;
        const user2_id = user.id < targetUserId ? targetUserId : user.id;
        
        await supabase.from('matches').insert({
          user1_id,
          user2_id
        });
      }
      return true;
    }
  }

  return false;
};
