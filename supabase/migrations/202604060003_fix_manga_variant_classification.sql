with known_manga(card_id, set_id) as (
  values
    ('OP01-120', 'OP01'),
    ('OP02-013', 'OP02'),
    ('OP03-122', 'OP03'),
    ('OP04-083', 'OP04'),
    ('OP05-119', 'OP05'),
    ('OP06-118', 'OP06'),
    ('OP07-051', 'OP07'),
    ('OP08-118', 'OP08'),
    ('OP09-119', 'OP09'),
    ('OP10-119', 'OP10'),
    ('OP11-118', 'OP11'),
    ('OP12-118', 'OP12'),
    ('OP13-118', 'OP13'),
    ('OP14-119', 'OP14'),
    ('OP15-118', 'OP15'),
    ('EB01-006', 'EB01'),
    ('EB02-061', 'EB02'),
    ('OP01-016', 'PRB01')
)
update public.card_variants as cv
set
  variant_type = 'M',
  variant_rarity = 'Manga Rare'
from known_manga
where cv.card_id = known_manga.card_id
  and cv.set_id = known_manga.set_id
  and cv.source_variant_key in ('P2', 'M')
  and (
    cv.variant_type <> 'M'
    or cv.variant_rarity <> 'Manga Rare'
  );

with known_manga(card_id, set_id) as (
  values
    ('OP01-120', 'OP01'),
    ('OP02-013', 'OP02'),
    ('OP03-122', 'OP03'),
    ('OP04-083', 'OP04'),
    ('OP05-119', 'OP05'),
    ('OP06-118', 'OP06'),
    ('OP07-051', 'OP07'),
    ('OP08-118', 'OP08'),
    ('OP09-119', 'OP09'),
    ('OP10-119', 'OP10'),
    ('OP11-118', 'OP11'),
    ('OP12-118', 'OP12'),
    ('OP13-118', 'OP13'),
    ('OP14-119', 'OP14'),
    ('OP15-118', 'OP15'),
    ('EB01-006', 'EB01'),
    ('EB02-061', 'EB02'),
    ('OP01-016', 'PRB01')
)
update public.card_variants as cv
set
  variant_type = 'AA',
  variant_rarity = 'Alternate Art'
where cv.source_variant_key in ('P2', 'M')
  and (
    cv.variant_type = 'M'
    or cv.variant_rarity ilike '%manga%'
  )
  and not exists (
    select 1
    from known_manga
    where known_manga.card_id = cv.card_id
      and known_manga.set_id = cv.set_id
  );
