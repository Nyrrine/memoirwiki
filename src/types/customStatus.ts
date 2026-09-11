export interface CustomStatus {
    id: string;
    user_id: string;
    name: string;
    key: string;
    icon_url: string | null;
    classification: 'standard' | 'neutral' | 'positive' | 'negative';
    created_at: string;
}
export const CLASSIFICATION_COLORS: Record<string, string> = {
    standard: '#a16c40',
    neutral: '#f3bd04',
    positive: '#38a832',
    negative: '#c83030',
};
export const CLASSIFICATION_LABELS: Record<string, string> = {
    standard: 'Standard',
    neutral: 'Neutral',
    positive: 'Positive',
    negative: 'Negative',
};
