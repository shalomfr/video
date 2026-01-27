export const SCENE_PROMPT_TEMPLATE = (
  sceneDescription: string,
  brandColors: string[],
  visualStyle: string,
  targetAudience: string
) => `
צור prompt מדויק ליצירת סצנה בסרטון עם Veo AI.

## פרטי הסצנה:
${sceneDescription}

## הנחיות עיצוב:
- צבעי מותג: ${brandColors.join(', ')}
- סגנון ויזואלי: ${visualStyle}
- קהל יעד: ${targetAudience}

## דרישות טכניות:
- איכות וידאו 4K
- תנועה חלקה ונוזלית
- תאורה מקצועית
- קומפוזיציה מאוזנת
- אלמנטים ויזואליים תומכי המסר

## מבנה ה-Prompt:
1. תיאור הסצנה הראשי
2. אלמנטים ויזואליים ספציפיים
3. סגנון צילום ותנועה
4. אווירה ואפקטים
5. דגשים על צבעים וסגנון המותג

החזר prompt באנגלית בלבד, מוכן לשימוש ישיר עם Veo AI.
`;