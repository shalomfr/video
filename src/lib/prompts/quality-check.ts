export const QUALITY_CHECK_PROMPT = (
  expectedPrompt: string,
  brandColors: string[],
  visualStyle: string
) => `
נתח את איכות הסרטון הזה ואת ההתאמה שלו לדרישות.

## הדרישות המקוריות:
**Prompt:** ${expectedPrompt}

## קריטריוני איכות:
- התאמה ל-prompt: האם הסרטון משקף את התיאור המבוקש?
- איכות ויזואלית: בהירות, צבעים, תנועה, קומפוזיציה
- עקביות מותג: צבעים (${brandColors.join(', ')}), סגנון (${visualStyle})
- בעיות טכניות: טשטוש, קפיצות, סינכרון לקוי

## קנה מידה להערכה:
1-3: איכות נמוכה - דורש יצירה מחדש
4-6: איכות בינונית - ניתן לשפר
7-10: איכות גבוהה - מתאים לפרסום

## ניתוח מפורט:
1. ציון התאמה ל-prompt (1-10)
2. ציון איכות ויזואלית (1-10)
3. ציון עקביות מותג (1-10)
4. ממוצע משוקלל
5. רשימת בעיות ספציפיות
6. המלצה האם ליצור מחדש

החזר JSON:
{
  "matchesPrompt": true/false,
  "qualityScore": 1-10,
  "issues": ["בעיה ספציפית 1", "בעיה ספציפית 2"],
  "shouldRegenerate": true/false,
  "detailedAnalysis": {
    "promptMatch": 1-10,
    "visualQuality": 1-10,
    "brandConsistency": 1-10
  }
}
`;