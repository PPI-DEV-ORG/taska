/**
 * Biaya langsung project = HPP project (bukan beban operasional kantor).
 *
 *   Semua biaya yang terjadi KARENA project — bensin/tol/makan tim lapangan, petty cash project, jasa vendor,
 *   dan biaya SURVEY untuk prospek yang kemudian menjadi project — didebit ke "HPP Biaya Langsung Project"
 *   (mapping PROJECT_DIRECT_COST, akun 5103) dan masuk HPP di laba-rugi project.
 *   Biaya overhead kantor & survey yang TIDAK menjadi project tetap beban operasional / pemasaran.
 */
export const PROJECT_DIRECT_COST_DEFAULT = "5103";

export function projectCostAccount(map: Record<string, string>, projectId: number | null | undefined, fallback: string): string {
  return projectId ? map.PROJECT_DIRECT_COST || PROJECT_DIRECT_COST_DEFAULT : fallback;
}

/** Project yang lahir dari prospek survey ini (lewat penawaran prospek tersebut), bila ada. */
export async function projectIdForSurvey(db: any, surveyId?: number | null): Promise<number | null> {
  if (!surveyId) return null;
  const sv = await db.survey.findUnique({ where: { id: surveyId }, select: { leadId: true } });
  if (!sv?.leadId) return null;
  const pj = await db.project.findFirst({ where: { quotation: { leadId: sv.leadId } }, orderBy: { id: "desc" }, select: { id: true } });
  return pj?.id ?? null;
}

/** Survey milik prospek project ini (prospek dari penawaran project). */
export async function surveyIdsForProject(db: any, projectId: number): Promise<number[]> {
  const pj = await db.project.findUnique({ where: { id: projectId }, select: { quotation: { select: { leadId: true } } } });
  const leadId = pj?.quotation?.leadId;
  if (!leadId) return [];
  const rows = await db.survey.findMany({ where: { leadId }, select: { id: true } });
  return rows.map((r: { id: number }) => r.id);
}
