import type { Challenge, DailyLog } from "@/types/type";

export type TaskStatus = {
  id: string;
  label: string;
  completed: boolean;
};

/**
 * Check if all tracked tasks for a day are complete
 */
export function isDayComplete(challenge: Challenge, log: DailyLog | null, allLogs?: DailyLog[]): boolean {
  if (!challenge || !log) return false;
  
  const tasks = getTaskStatuses(challenge, log, allLogs);
  return tasks.every(task => task.completed);
}

/**
 * Get list of incomplete tasks for a day
 */
export function getIncompleteTasks(challenge: Challenge, log: DailyLog | null, allLogs?: DailyLog[]): TaskStatus[] {
  if (!challenge || !log) return [];
  
  const tasks = getTaskStatuses(challenge, log, allLogs);
  return tasks.filter(task => !task.completed);
}

/**
 * Get list of completed tasks for a day
 */
export function getCompletedTasks(challenge: Challenge, log: DailyLog | null, allLogs?: DailyLog[]): TaskStatus[] {
  if (!challenge || !log) return [];
  
  const tasks = getTaskStatuses(challenge, log, allLogs);
  return tasks.filter(task => task.completed);
}

/**
 * Get task status details for all tracked tasks
 */
export function getTaskStatuses(challenge: Challenge, log: DailyLog | null, allLogs?: DailyLog[]): TaskStatus[] {
  if (!challenge) return [];
  
  const tasks: TaskStatus[] = [];
  
  // Steps - need to meet goal
  if (challenge.trackSteps) {
    tasks.push({
      id: "steps",
      label: "Steps",
      completed: log?.stepsCompleted === true || (log?.stepsCount ?? 0) >= challenge.stepsGoal,
    });
  }
  
  // Water - need to meet goal
  if (challenge.trackWater) {
    tasks.push({
      id: "water",
      label: "Water",
      completed: log?.waterCompleted === true || (log?.waterLiters ?? 0) >= challenge.waterLiters,
    });
  }
  
  // Workout 1 - need to complete workout of required minutes
  if (challenge.trackWorkout1) {
    tasks.push({
      id: "workout1",
      label: "Workout 1",
      completed: log?.workout1Completed === true || (log?.workout1Minutes ?? 0) >= challenge.workoutMinutes,
    });
  }
  
  // Workout 2 - need to complete workout of required minutes
  if (challenge.trackWorkout2) {
    tasks.push({
      id: "workout2",
      label: "Workout 2",
      completed: log?.workout2Completed === true || (log?.workout2Minutes ?? 0) >= challenge.workoutMinutes,
    });
  }
  
  // Reading - need to read required pages
  if (challenge.trackReading) {
    tasks.push({
      id: "reading",
      label: "Reading",
      completed: log?.readingCompleted === true || (log?.readingPages ?? 0) >= challenge.readingPages,
    });
  }
  
  // Diet - need to log something
  if (challenge.trackDiet) {
    tasks.push({
      id: "diet",
      label: "Diet",
      completed: log?.dietCompleted === true,
    });
  }
  
  // Calories - need to log something
  if (challenge.trackCalories) {
    tasks.push({
      id: "calories",
      label: "Calories",
      completed: (log?.caloriesConsumed ?? 0) > 0,
    });
  }
  
  // Weight - need to log
  if (challenge.trackWeight) {
    tasks.push({
      id: "weight",
      label: "Weight",
      completed: log?.weightLogged === true,
    });
  }
  
  // Progress photo - check based on frequency setting
  if (challenge.trackProgressPhoto) {
    const photoFrequency = challenge.progressPhotoDays ?? 1;
    let photoCompleted = log?.progressPhotoCompleted === true;
    
    // If frequency > 1, check if any recent photo in the allowed window
    if (!photoCompleted && photoFrequency > 1 && allLogs) {
      const today = new Date(log?.date ?? new Date());
      const logsWithinWindow = allLogs.filter(l => {
        const logDate = new Date(l.date);
        const daysDiff = Math.abs(Math.floor((today.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24)));
        return daysDiff < photoFrequency && l.progressPhotoCompleted;
      });
      photoCompleted = logsWithinWindow.length > 0;
    }
    
    tasks.push({
      id: "photo",
      label: "Progress Photo",
      completed: photoCompleted,
    });
  }
  
  // No alcohol - checked off
  if (challenge.trackNoAlcohol) {
    tasks.push({
      id: "alcohol",
      label: "No Alcohol",
      completed: log?.noAlcoholCompleted === true,
    });
  }
  
  // Mood - logged
  if (challenge.trackMood) {
    tasks.push({
      id: "mood",
      label: "Mood",
      completed: (log?.moodScore ?? 0) > 0,
    });
  }
  
  // Sleep - need to meet goal hours
  if (challenge.trackSleep) {
    const sleepGoalMinutes = (challenge.sleepGoalHours || 8) * 60;
    tasks.push({
      id: "sleep",
      label: "Sleep",
      completed: log?.sleepCompleted === true || (log?.sleepMinutes ?? 0) >= sleepGoalMinutes,
    });
  }
  
  // Cycle - logged (only if tracking)
  if (challenge.trackCycle) {
    // Cycle is optional each day - consider complete if today was logged
    // This is a special case as not every day needs logging
    tasks.push({
      id: "cycle",
      label: "Cycle",
      completed: true, // Cycle is always "done" - it's optional logging
    });
  }
  
  // Skincare - completed
  if (challenge.trackSkincare) {
    tasks.push({
      id: "skincare",
      label: "Skincare",
      completed: log?.skincareCompleted === true,
    });
  }
  
  return tasks;
}

/**
 * Calculate overall completion percentage for a day
 */
export function getDayCompletionPercentage(challenge: Challenge, log: DailyLog | null, allLogs?: DailyLog[]): number {
  const tasks = getTaskStatuses(challenge, log, allLogs);
  if (tasks.length === 0) return 0;
  
  const completedCount = tasks.filter(t => t.completed).length;
  return Math.round((completedCount / tasks.length) * 100);
}
