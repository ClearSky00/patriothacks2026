export interface Voice {
  id: string;
  voice_id: string;
  user_id: string;
  name: string;
  language: string;
  created_at: string;
}

export interface Book {
  id: string;
  title: string;
  user_id: string;
  source_language: string;
  created_at: string;
}

export interface BookPage {
  id: string;
  book_id: string;
  page_num: number;
  original_text: string;
  translated_text: string;
  vocab: { english: string; original: string }[];
  is_illustration: boolean;
  created_at: string;
}
