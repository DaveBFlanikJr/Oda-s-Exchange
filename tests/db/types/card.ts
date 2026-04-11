export default interface Card {
  id: string;
  card_set_id: string;
  name_en: string;
  name_jp: string | null;
  card_type: "booster" | "starter_deck" | "promo" | "don";
  game: string;
  set_id: string;
  set_name_en: string | null;
  set_name_jp: string | null;
  rarity: string | null;
  card_category: string | null;
  card_color: string | null;
  card_cost: string | null;
  card_power: string | null;
  counter_amount: number | null;
  attribute: string | null;
  sub_types: string | null;
  card_text: string | null;
  card_image: string | null;
}
