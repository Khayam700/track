"use server";

import { updateLogPrediction } from "@/lib/db";

export async function submitPrediction(formData) {
  const logIdStr = formData.get("logId");
  const prediction = formData.get("prediction");
  const fullName = formData.get("fullName");
  const phone = formData.get("phone");

  if (!logIdStr || !prediction || !fullName || !phone) {
    return { success: false, error: "جميع الحقول مطلوبة!" };
  }

  const logId = parseInt(logIdStr, 10);
  if (isNaN(logId)) {
    return { success: false, error: "معرّف تتبع غير صالح!" };
  }

  try {
    updateLogPrediction(logId, {
      prediction,
      fullName: fullName.trim(),
      phone: phone.trim(),
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to save prediction:", error);
    return { success: false, error: "حدث خطأ أثناء حفظ التوقع. حاول مرة أخرى." };
  }
}
