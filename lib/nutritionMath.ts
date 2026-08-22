/**
 * lib/nutritionMath.ts
 *
 * Pure math for the "Protein Math" workspace. Fixed to 2 meals/day
 * (lunch + dinner), split evenly — see NutritionConfig in lib/types.ts.
 */

import type { NutritionPerson, ProteinSource } from "./types";

const MEALS_PER_DAY = 2;

/** Grams of protein this person is targeting per day. */
export function dailyProteinTarget(person: NutritionPerson): number {
  return person.weightKg * person.gramsPerKg;
}

/** Grams of protein this person is targeting per meal (daily target ÷ 2). */
export function perMealProteinTarget(person: NutritionPerson): number {
  return dailyProteinTarget(person) / MEALS_PER_DAY;
}

/**
 * Grams of this protein source (in whatever basis — raw or cooked — it was
 * entered) needed for one person to hit their per-meal target. Returns null
 * if the source has no usable protein-per-100g figure yet.
 */
export function gramsNeededPerMeal(
  person: NutritionPerson,
  source: ProteinSource,
): number | null {
  if (!source.proteinPer100g || source.proteinPer100g <= 0) return null;
  return (perMealProteinTarget(person) / source.proteinPer100g) * 100;
}

/**
 * Combined grams of this protein needed to cover BOTH people's meals for the
 * whole day — i.e. "if you built today's lunch and dinner entirely around
 * this one protein, here's how much to buy/prep total."
 */
export function gramsNeededCombinedDaily(
  people: [NutritionPerson, NutritionPerson],
  source: ProteinSource,
): number | null {
  const a = gramsNeededPerMeal(people[0], source);
  const b = gramsNeededPerMeal(people[1], source);
  if (a === null || b === null) return null;
  return (a + b) * MEALS_PER_DAY;
}
