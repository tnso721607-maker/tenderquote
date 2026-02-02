
import { GoogleGenAI, Type } from "@google/genai";
import { SORItem, MatchResult } from "../types.ts";

// Defensive access to environment variables
const getApiKey = () => {
  try {
    return process?.env?.API_KEY || '';
  } catch (e) {
    return '';
  }
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

export async function checkScopeMatch(
  requestedScope: string,
  existingScope: string
): Promise<MatchResult> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Compare these two descriptions of 'Scope of Work' for a construction or technical tender item. 
      Determine if they are functionally equivalent or if the existing scope covers the requested requirements.

      Requested Scope: "${requestedScope}"
      Existing Scope in Database: "${existingScope}"
      
      Return a JSON object indicating if it's a match, a confidence score (0-1), and a brief reasoning.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isMatch: { type: Type.BOOLEAN },
            confidence: { type: Type.NUMBER },
            reason: { type: Type.STRING },
          },
          required: ["isMatch", "confidence", "reason"],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    return {
      isMatch: result.isMatch ?? false,
      confidence: result.confidence ?? 0,
      reason: result.reason ?? "Unknown",
    };
  } catch (error) {
    console.error("Gemini scope check failed:", error);
    return { isMatch: false, confidence: 0, reason: "Error validating scope." };
  }
}

/**
 * Finds the most similar item from a list of available database items using semantic similarity.
 */
export async function findBestMatchingItem(
  targetItemName: string,
  targetScope: string,
  dbItems: { id: string; name: string }[]
): Promise<string | null> {
  if (dbItems.length === 0) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `I have a tender item: "${targetItemName}" with scope: "${targetScope}".
      I have a list of items from my database below. 
      Identify which item from the list is the most similar or a functional equivalent.
      
      Database Items:
      ${dbItems.map(item => `- ${item.name} (ID: ${item.id})`).join('\n')}
      
      If there is a reasonably close match (even if not exact), return the ID of that item.
      If NO items are even remotely similar, return null.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchedId: { type: Type.STRING, nullable: true },
            reason: { type: Type.STRING }
          },
          required: ["matchedId"]
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    return result.matchedId || null;
  } catch (error) {
    console.error("Semantic matching failed:", error);
    return null;
  }
}

export async function parseBulkItems(text: string): Promise<any[]> {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Extract a list of items from this raw text which might be a copy-paste from a tender document or spreadsheet.
            Identify: Name of item, Quantity, Scope of Work description, and any provided Estimated Rate or Unit Rate that is mentioned in the text.
            
            Text:
            ${text}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            quantity: { type: Type.NUMBER },
                            requestedScope: { type: Type.STRING },
                            estimatedRate: { type: Type.NUMBER, description: "The existing rate provided in the list if any" }
                        },
                        required: ["name", "quantity", "requestedScope"]
                    }
                }
            }
        });
        return JSON.parse(response.text || '[]');
    } catch (e) {
        return [];
    }
}

export async function parseRatesFromText(text: string): Promise<Omit<SORItem, 'id' | 'timestamp'>[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract detailed Schedule of Rates (SOR) data from the following raw text. 
      The text might contain item names, units (m3, sqm, kg, etc.), rates (numerical values), scope of work descriptions, and source/reference information.
      
      If a piece of information like 'Source' is missing, leave it as an empty string.
      
      Text:
      ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "The name of the item" },
              unit: { type: Type.STRING, description: "The unit of measurement (e.g., m3, kg)" },
              rate: { type: Type.NUMBER, description: "The rate/price per unit" },
              scopeOfWork: { type: Type.STRING, description: "The detailed scope of work or technical specification" },
              source: { type: Type.STRING, description: "The source document or reference for this rate" },
            },
            required: ["name", "unit", "rate", "scopeOfWork", "source"]
          },
        },
      },
    });

    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error("Gemini rate parsing failed:", error);
    return [];
  }
}
