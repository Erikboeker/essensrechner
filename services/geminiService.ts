
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        food_items: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    weight_grams: { type: Type.NUMBER },
                    nutrients: {
                        type: Type.OBJECT,
                        properties: {
                            calories: { type: Type.NUMBER },
                            carbohydrates_grams: { type: Type.NUMBER },
                            sugar_grams: { type: Type.NUMBER },
                            fiber_grams: { type: Type.NUMBER },
                            starch_grams: { type: Type.NUMBER },
                            sugar_alcohol_grams: { type: Type.NUMBER },
                            protein_grams: { type: Type.NUMBER },
                            fat_grams: { type: Type.NUMBER }
                        },
                        required: ["calories", "carbohydrates_grams", "protein_grams", "fat_grams"]
                    }
                },
                required: ["name", "weight_grams", "nutrients"]
            }
        },
        diabetic_note: { type: Type.STRING },
        clarification_question: { type: Type.STRING }
    },
    required: ["food_items", "diabetic_note"]
};

export const analyzeMealImage = async (imageData: string, correctionText?: string | null): Promise<AnalysisResult> => {
    const base64Data = imageData.split(',')[1];
    if (!base64Data) {
        throw new Error("Invalid image data format.");
    }

    const systemPrompt = `Du bist ein Ernährungsberater-Assistent für Diabetiker. Analysiere das Bild einer Mahlzeit.
    1. Identifiziere jedes Lebensmittel so genau wie möglich.
    2. Schätze für jedes Lebensmittel das Gewicht in Gramm.
    3. Berechne die Nährwerte. Gib bei den Kohlenhydraten eine detaillierte Aufschlüsselung an: 'carbohydrates_grams' (Gesamt), 'sugar_grams', 'fiber_grams', 'starch_grams' (Stärke), und 'sugar_alcohol_grams' (Zuckeralkohole). Setze Werte auf 0, wenn sie nicht zutreffen.
    4. Gib einen speziellen Hinweis für Diabetiker, der die Broteinheiten (BE), Fett-Protein-Einheiten (FPE), den Zucker und andere relevante Aspekte bewertet.
    5. Wenn der Benutzer eine Korrektur liefert (z.B. "das ist Vollkornreis"), musst du diese Korrektur als Wahrheit ansehen.
    6. Wenn etwas unklar ist, stelle eine 'clarification_question'.
    Stelle sicher, dass deine Antwort ausschließlich im JSON-Format gemäß dem Schema vorliegt.`;

    const userPrompt = correctionText
        ? `Analysiere das Essen auf diesem Bild erneut. Beachte dabei unbedingt die folgende Korrektur des Benutzers: "${correctionText}"`
        : "Analysiere das Essen auf diesem Bild und gib die Nährwertinformationen zurück.";

    // FIX: Updated generateContent call to align with the latest SDK guidelines.
    // `systemInstruction` is now a string property within the `config` object.
    // `contents` for a single multimodal request is a Content object, not an array.
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
            parts: [
                { text: userPrompt },
                { inlineData: { mimeType: "image/png", data: base64Data } }
            ]
        },
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: responseSchema
        }
    });

    const jsonText = response.text;
    if (!jsonText) {
        throw new Error("Die Antwort der KI war leer oder fehlerhaft.");
    }
    return JSON.parse(jsonText);
};

export const fetchSuggestion = async (mealData: AnalysisResult, suggestionType: 'alternative' | 'plan'): Promise<string> => {
    const mealSummary = mealData.food_items.map(item => `${item.name} (~${item.weight_grams.toFixed(0)}g)`).join(', ');

    const systemPrompt = "Du bist ein hilfreicher und motivierender Ernährungs-Coach, der auf Diabetes spezialisiert ist. Deine Sprache ist einfach, positiv und leicht verständlich. Antworte immer auf Deutsch.";

    let userPrompt = "";
    if (suggestionType === 'alternative') {
        userPrompt = `Die analysierte Mahlzeit besteht aus: ${mealSummary}. Gib mir ein oder zwei konkrete, umsetzbare Verbesserungsvorschläge, um diese Mahlzeit für einen Diabetiker beim nächsten Mal gesünder zu machen. Konzentriere dich auf den Austausch von Zutaten oder die Zubereitungsart. Formatiere deine Antwort mit Markdown (z.B. **fett** für Überschriften, Listenpunkte).`;
    } else { // 'plan'
        const hour = new Date().getHours();
        const mealTime = hour < 11 ? "Frühstück" : hour < 16 ? "Mittagessen" : "Abendessen";
        userPrompt = `Die analysierte Mahlzeit (${mealSummary}) wurde gerade als ${mealTime} gegessen. Erstelle einen einfachen, ausgewogenen Essensplan für die restlichen Mahlzeiten des heutigen Tages, der für einen Diabetiker geeignet ist. Gib für die vorgeschlagenen Mahlzeiten ebenfalls eine grobe Schätzung für BE und FPE an. Formatiere deine Antwort mit Markdown (z.B. **fett** für Überschriften, Listenpunkte).`;
    }

    // FIX: Updated generateContent call to align with the latest SDK guidelines.
    // `systemInstruction` is now a string property within the `config` object.
    // `contents` is simplified to a string for a text-only prompt.
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: userPrompt,
        config: {
            systemInstruction: systemPrompt,
        },
    });

    const text = response.text;
    if (!text) {
        throw new Error("Die KI-Antwort war leer.");
    }
    return text;
};
