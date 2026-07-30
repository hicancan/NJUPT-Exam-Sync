import type { Exam } from '../records';

export type ClassLookupMode = 'EMPTY' | 'NOT_FOUND' | 'LIST' | 'DETAIL';

export interface ClassLookupResult {
    mode: ClassLookupMode;
    classes: string[];
    exams: Exam[];
}

const CLASS_LOOKUP_PATTERN = /^[BFPQY]\d{2,}(?:\([A-Z0-9]+\))?$/;
const COMPLETE_CLASS_PATTERN = /^[BFPQY]\d{6}(?:\([A-Z0-9]+\))?$/;

export const normalizeClassQuery = (value: string): string => value.trim();

export const isClassLookupQuery = (value: string): boolean => {
    return CLASS_LOOKUP_PATTERN.test(normalizeClassQuery(value));
};

export const isCompleteClassQuery = (value: string): boolean => {
    return COMPLETE_CLASS_PATTERN.test(normalizeClassQuery(value));
};

export const isExamHelperQuery = (value: string): boolean => value.trim() === '考试安排';

export const getClassNameSearchResult = (
    classNames: string[],
    inputValue: string,
    manualSelection: string | null
): ClassLookupResult => {
    const trimmed = inputValue.trim();
    if (trimmed.length < 2) {
        return { mode: 'EMPTY', classes: [], exams: [] };
    }

    if (manualSelection) {
        const normalizedManualSelection = normalizeClassQuery(manualSelection);
        const selectedClass = classNames.find(className => className === normalizedManualSelection) || null;
        return selectedClass
            ? { mode: 'DETAIL', classes: [selectedClass], exams: [] }
            : { mode: 'NOT_FOUND', classes: [], exams: [] };
    }

    const term = trimmed;
    const uniqueClasses = classNames
        .filter(className => className.includes(term))
        .sort();

    if (uniqueClasses.length === 0) {
        return { mode: 'NOT_FOUND', classes: [], exams: [] };
    }

    if (uniqueClasses.length === 1) {
        return { mode: 'DETAIL', classes: uniqueClasses, exams: [] };
    }

    return { mode: 'LIST', classes: uniqueClasses, exams: [] };
};

export const getClassSearchResult = (
    exams: Exam[],
    inputValue: string,
    manualSelection: string | null
): ClassLookupResult => {
    const trimmed = inputValue.trim();
    if (trimmed.length < 2) {
        return { mode: 'EMPTY', classes: [], exams: [] };
    }

    if (manualSelection) {
        const selectedExams = exams.filter(exam => exam.class_name === manualSelection);
        if (selectedExams.length === 0) {
            return { mode: 'NOT_FOUND', classes: [], exams: [] };
        }
        return {
            mode: 'DETAIL',
            classes: [manualSelection],
            exams: selectedExams
        };
    }

    const term = trimmed;
    const matchedExams = exams.filter(exam =>
        exam.class_name.includes(term)
    );
    const uniqueClasses = Array.from(new Set(matchedExams.map(exam => exam.class_name))).sort();

    if (uniqueClasses.length === 0) {
        return { mode: 'NOT_FOUND', classes: [], exams: [] };
    }

    if (uniqueClasses.length === 1) {
        return { mode: 'DETAIL', classes: uniqueClasses, exams: matchedExams };
    }

    return { mode: 'LIST', classes: uniqueClasses, exams: [] };
};
