
export interface Nutrients {
  calories: number;
  carbohydrates_grams: number;
  sugar_grams?: number;
  fiber_grams?: number;
  starch_grams?: number;
  sugar_alcohol_grams?: number;
  protein_grams: number;
  fat_grams: number;
}

export interface FoodItem {
  name: string;
  weight_grams: number;
  nutrients: Nutrients;
}

export interface AnalysisResult {
  food_items: FoodItem[];
  diabetic_note: string;
  clarification_question?: string;
}

export interface Meal extends AnalysisResult {
  date: string;
  image: string;
}
