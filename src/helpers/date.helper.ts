/**
 * Format date to ISO string
 */
export const formatDate = (date: Date): string => {
  return date.toISOString();
};

/**
 * Get current timestamp
 */
export const getCurrentTimestamp = (): Date => {
  return new Date();
};

export const getTimestampMinutesFromNow = (minutes: number): Date => {
  return new Date(Date.now() + minutes * 60 * 1000);
};

/**
 * Add days to a date
 */
export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const subtractDays = (date: Date, days: number) => {
  const todaysDate = new Date(date);
  const aWeekAgo = new Date(date);

  aWeekAgo.setDate(aWeekAgo.getDate() - days);

  return {
    todaysDate: todaysDate.toISOString(),
    aWeekAgo: aWeekAgo.toISOString(),
  };
};

export const isValidDate = (date: string): boolean => {
  const result = new Date(date);

  if (result.toString() === "Invalid Date") {
    return false;
  }

  return true;
};

/**
 * Check if date is in the past
 */
export const isPastDate = (date: Date): boolean => {
  return date < new Date();
};

/**
 * Format date to readable string
 */
export const formatReadableDate = (date: Date): string => {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/**
 * Parse and validate a startDate/endDate query param pair.
 * Returns parsed dates, or an error message if either is invalid
 * or startDate is after endDate.
 */
export const parseDateRange = (
  startDate?: string,
  endDate?: string,
): {
  parsedStartDate?: Date;
  parsedEndDate?: Date;
  error?: string;
} => {
  let parsedStartDate: Date | undefined;
  let parsedEndDate: Date | undefined;

  if (startDate) {
    const parsed = new Date(startDate);
    if (isNaN(parsed.getTime())) {
      return { error: "startDate is not a valid date" };
    }
    parsedStartDate = parsed;
  }

  if (endDate) {
    const parsed = new Date(endDate);
    if (isNaN(parsed.getTime())) {
      return { error: "endDate is not a valid date" };
    }
    parsedEndDate = parsed;
  }

  if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
    return { error: "startDate cannot be after endDate" };
  }

  return { parsedStartDate, parsedEndDate };
};