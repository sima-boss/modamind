-- ============================================================
-- ModaMind — Seed 60 days of realistic history for demo@modamind.com
--
-- Feeds the Step 5 analytics charts: a rising usage trend with a
-- weekday/weekend rhythm (usage_events), plus backdated saved outfits +
-- captions across themes/languages/formats. Re-runnable: does nothing if
-- the demo user is missing or already has history older than a week.
-- ============================================================

do $$
declare
  v_user uuid;
  v_period_start timestamptz;
  v_product_count int;
  v_outfit_id uuid;
  v_created timestamptz;
  v_theme text;
  v_lang text;
  v_format text;
  d int;
  n_outfits int;
  n_captions int;
  dow int;
  r int;
  themes text[] := array[
    'Weekend Casual', 'Weekend Casual', 'Weekend Casual',
    'Office Essentials', 'Office Essentials',
    'Smart Casual', 'Smart Casual',
    'Evening Look', 'Date Night', 'Streetwear',
    'Business Meeting', 'Beach / Resort', 'Eid / Celebration', 'Gym / Athleisure'
  ];
begin
  select id into v_user from auth.users where email = 'demo@modamind.com';
  if v_user is null then
    raise notice 'demo@modamind.com not found — skipping analytics seed';
    return;
  end if;

  if exists (
    select 1 from public.usage_events
    where user_id = v_user and created_at < now() - interval '7 days'
  ) then
    raise notice 'demo analytics history already present — skipping';
    return;
  end if;

  -- 1. Usage events: ~30/day two months ago rising to ~85/day now.
  for d in reverse 59..0 loop
    dow := extract(dow from ((now() - make_interval(days => d)) at time zone 'Asia/Dubai'))::int;
    n_outfits := round(
      (30 + (59 - d) * 0.93)
      * (case when dow in (5, 6) then 0.6 else 1 end)   -- Fri/Sat dip
      * (0.75 + random() * 0.5)
    );
    n_captions := round(n_outfits * 0.35 * (0.8 + random() * 0.4));

    insert into public.usage_events (user_id, type, created_at)
    select v_user, 'outfit_generation',
           now() - make_interval(days => d) - random() * interval '12 hours'
    from generate_series(1, n_outfits);

    insert into public.usage_events (user_id, type, created_at)
    select v_user, 'ai_caption',
           now() - make_interval(days => d) - random() * interval '12 hours'
    from generate_series(1, n_captions);
  end loop;

  -- Keep the subscription counters consistent with the seeded events for
  -- the current billing period (the dashboard reads the counters).
  select current_period_start into v_period_start
  from public.subscriptions where user_id = v_user;

  if v_period_start is not null then
    update public.subscriptions s
    set outfit_generations_used = (
          select count(*) from public.usage_events e
          where e.user_id = v_user and e.type = 'outfit_generation'
            and e.created_at >= v_period_start),
        ai_captions_used = (
          select count(*) from public.usage_events e
          where e.user_id = v_user and e.type = 'ai_caption'
            and e.created_at >= v_period_start)
    where s.user_id = v_user;
  end if;

  -- 2. Make sure there are enough products to build outfits from.
  select count(*) into v_product_count from public.products where owner_id = v_user;
  if v_product_count < 8 then
    insert into public.products (owner_id, name, category, price)
    values
      (v_user, 'Demo Linen Shirt',        'tops',        189),
      (v_user, 'Demo Cotton Tee',         'tops',         89),
      (v_user, 'Demo Tailored Trousers',  'bottoms',     259),
      (v_user, 'Demo Slim Jeans',         'bottoms',     219),
      (v_user, 'Demo Leather Sneakers',   'shoes',       349),
      (v_user, 'Demo Suede Loafers',      'shoes',       399),
      (v_user, 'Demo Wool Blazer',        'outerwear',   549),
      (v_user, 'Demo Leather Watch Strap','accessories', 129),
      (v_user, 'Demo Tote Bag',           'bags',        299);
  end if;

  -- 3. Backdated saved outfits + captions (one most days, ~45 total).
  for d in reverse 59..0 loop
    continue when random() < 0.25;

    v_created := now() - make_interval(days => d) - random() * interval '12 hours';
    v_theme := themes[1 + floor(random() * array_length(themes, 1))::int];

    insert into public.outfits (owner_id, theme_name, title, created_at)
    values (v_user, v_theme, v_theme, v_created)
    returning id into v_outfit_id;

    insert into public.outfit_items (outfit_id, product_id, role)
    select v_outfit_id, p.id,
           case p.category
             when 'tops' then 'top'
             when 'bottoms' then 'bottom'
             when 'dresses' then 'dress'
             when 'outerwear' then 'outerwear'
             when 'shoes' then 'shoes'
             else 'accessory'
           end
    from (
      select distinct on (category) id, category
      from public.products
      where owner_id = v_user
      order by category, random()
    ) p
    limit 4;

    v_lang := case when random() < 0.3 then 'ar' else 'en' end;
    r := floor(random() * 10)::int;
    v_format := case when r < 5 then 'instagram' when r < 8 then 'tiktok' else 'generic' end;

    insert into public.outfit_content
      (outfit_id, description, styling_tips, social_caption, language, format, created_at)
    values (
      v_outfit_id,
      case v_lang
        when 'ar' then 'إطلالة أنيقة ومريحة تناسب ' || v_theme
        else 'A polished, easy-to-wear look built for ' || lower(v_theme) || '.'
      end,
      case v_lang
        when 'ar' then E'اختر ألواناً متناسقة\nأضف إكسسوار بسيط'
        else E'Keep the palette tonal\nFinish with one statement accessory'
      end,
      case v_lang
        when 'ar' then 'إطلالتي اليوم ✨ #ستايل'
        else 'Today''s look ✨ #ootd'
      end,
      v_lang,
      v_format,
      v_created
    );
  end loop;
end
$$;
