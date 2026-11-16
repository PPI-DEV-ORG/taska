/**
 * Nilai persetujuan "Permintaan survey" = biaya survey atau total petty cash untuk survey itu (mana yang lebih besar),
 * supaya yang menyetujui (Finance / PM / Bos) melihat nominal yang benar — bukan Rp 0 dari saat survey baru dibuat.
 * Hanya persetujuan yang masih menunggu yang disesuaikan.
 */
export async function syncSurveyApprovalAmount(db: any, surveyId?: number | null): Promise<void> {
  if (!surveyId) return;
  try {
    const sv = await db.survey.findUnique({ where: { id: surveyId }, select: { cost: true } });
    if (!sv) return;
    const advances = await db.cashAdvance.findMany({
      where: { surveyId, status: { notIn: ["DITOLAK", "DIBATALKAN"] } },
      select: { amount: true, approvedAmount: true },
    });
    const pettyCash = advances.reduce((s: number, a: any) => s + Number(a.approvedAmount ?? a.amount ?? 0), 0);
    const amount = Math.max(Number(sv.cost || 0), pettyCash);
    await db.approval.updateMany({
      where: { kind: "PERMINTAAN_SURVEY", entityId: surveyId, status: "MENUNGGU" },
      data: { amount },
    });
  } catch (e) {
    console.warn("Gagal menyelaraskan nilai persetujuan survey:", (e as Error).message);
  }
}
