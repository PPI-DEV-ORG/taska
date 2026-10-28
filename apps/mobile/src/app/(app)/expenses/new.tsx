import * as React from "react";
import { View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { AlertTriangle, Check } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/text";
import { PageHeader, Panel, FormField } from "@/components/taska/basics";
import { DatePicker, SearchableSelect } from "@/components/taska/dialogs";
import { FileUploader, type FileUploaderHandle } from "@/components/taska/file-uploader";
import { useApp } from "@/store/app-store";
import { BOS_THRESHOLD, colors } from "@/tokens";
import { rupiah } from "@/lib/format";

const DEFAULT_KATEGORI_LIST = [
  "Bensin",
  "Makan & Lembur",
  "Transport & Taksi",
  "Parkir & Tol",
  "Perlengkapan Teknisi",
  "Penginapan / Hotel",
  "Lain-lain",
];

export default function NewExpenseScreen() {
  const router = useRouter();
  const { data, user, addRow, toast } = useApp();
  const fileHandle = React.useRef<FileUploaderHandle | null>(null);

  const kategoriOptions = React.useMemo(() => {
    const dynamic = (data.expenseCategories ?? []).map((c: any) => String(c.nama)).filter(Boolean);
    return dynamic.length > 0 ? dynamic : DEFAULT_KATEGORI_LIST;
  }, [data.expenseCategories]);

  const params = useLocalSearchParams<{
    projectId?: string;
    project?: string;
    surveyId?: string;
    survey?: string;
    pocId?: string;
    pocReportId?: string;
    poc?: string;
    visitId?: string;
    visitReportId?: string;
    visit?: string;
  }>();

  const [tanggalNota, setTanggalNota] = React.useState(new Date().toISOString().slice(0, 10));
  const [nominal, setNominal] = React.useState("");
  const [kategori, setKategori] = React.useState(kategoriOptions[0] || "Bensin");

  const defaultProject = React.useMemo(() => {
    if (params.project) return String(params.project);
    if (params.projectId) {
      const match = data.projects.find((p) => String(p.id) === String(params.projectId));
      return match ? String(match.nama) : "-";
    }
    return "-";
  }, [params.project, params.projectId, data.projects]);

  const defaultSurvey = React.useMemo(() => {
    if (params.survey) return String(params.survey);
    if (params.surveyId) {
      const match = data.surveys.find((s: any) => String(s.id) === String(params.surveyId));
      return match ? `Survey #${match.id} - ${match.lead || match.customer || match.lokasi || "Survey"}` : "-";
    }
    return "-";
  }, [params.survey, params.surveyId, data.surveys]);

  const defaultPoc = React.useMemo(() => {
    const pId = params.pocId || params.pocReportId;
    if (params.poc) return String(params.poc);
    if (pId) {
      const match = ((data as any)["poc-reports"] ?? []).find((p: any) => String(p.id) === String(pId));
      return match ? `POC ${match.nomor || match.number} - ${match.judul || match.title}` : "-";
    }
    return "-";
  }, [params.poc, params.pocId, params.pocReportId, data]);

  const defaultVisit = React.useMemo(() => {
    const vId = params.visitId || params.visitReportId;
    if (params.visit) return String(params.visit);
    if (vId) {
      const match = ((data as any)["visit-reports"] ?? []).find((v: any) => String(v.id) === String(vId));
      return match ? `VISIT ${match.nomor || match.number} - ${match.judul || match.title}` : "-";
    }
    return "-";
  }, [params.visit, params.visitId, params.visitReportId, data]);

  const [customProject, setCustomProject] = React.useState<string | null>(null);
  const [customSurvey, setCustomSurvey] = React.useState<string | null>(null);
  const [customPoc, setCustomPoc] = React.useState<string | null>(null);
  const [customVisit, setCustomVisit] = React.useState<string | null>(null);

  const selectedProject = customProject ?? defaultProject;
  const selectedSurvey = customSurvey ?? defaultSurvey;
  const selectedPoc = customPoc ?? defaultPoc;
  const selectedVisit = customVisit ?? defaultVisit;

  const [sumberDana, setSumberDana] = React.useState<"Dana Perusahaan" | "Talangan Pribadi (Reimbursement)">("Dana Perusahaan");
  const [alasan, setAlasan] = React.useState("");
  const [photoCount, setPhotoCount] = React.useState(0);

  const surveyOptions = React.useMemo(() => {
    return [
      "-",
      ...(data.surveys ?? []).map(
        (s: any) => `Survey #${s.id} - ${s.lead || s.customer || s.lokasi || "Survey"}`
      ),
    ];
  }, [data.surveys]);

  const pocOptions = React.useMemo(() => {
    const list = (data as any)["poc-reports"] ?? [];
    return [
      "-",
      ...list.map((p: any) => `POC ${p.nomor || p.number} - ${p.judul || p.title}`),
    ];
  }, [data]);

  const visitOptions = React.useMemo(() => {
    const list = (data as any)["visit-reports"] ?? [];
    return [
      "-",
      ...list.map((v: any) => `VISIT ${v.nomor || v.number} - ${v.judul || v.title}`),
    ];
  }, [data]);

  const numNominal = Number(nominal.replace(/\D/g, "")) || 0;
  const isBig = numNominal > BOS_THRESHOLD;

  async function submit() {
    if (numNominal <= 0) {
      toast("Nominal pengeluaran harus lebih dari 0", "danger");
      return;
    }
    if (!alasan.trim()) {
      toast("Keterangan pengeluaran wajib diisi", "danger");
      return;
    }

    const fileId = (await fileHandle.current?.flush()) ?? undefined;
    const foundProject = data.projects.find(
      (p) => String(p.nama) === selectedProject || (params.projectId && String(p.id) === String(params.projectId))
    );
    const resolvedProjectId =
      foundProject?.id != null
        ? Number(foundProject.id)
        : params.projectId
          ? Number(params.projectId)
          : undefined;

    const foundSurvey = data.surveys.find((s: any) => {
      const opt = `Survey #${s.id} - ${s.lead || s.customer || s.lokasi || "Survey"}`;
      return opt === selectedSurvey || (params.surveyId && String(s.id) === String(params.surveyId));
    });
    const resolvedSurveyId =
      foundSurvey?.id != null
        ? Number(foundSurvey.id)
        : params.surveyId
          ? Number(params.surveyId)
          : undefined;

    const pocList = ((data as any)["poc-reports"] ?? []);
    const pId = params.pocId || params.pocReportId;
    const foundPoc = pocList.find((p: any) => {
      const opt = `POC ${p.nomor || p.number} - ${p.judul || p.title}`;
      return opt === selectedPoc || (pId && String(p.id) === String(pId));
    });
    const resolvedPocReportId =
      foundPoc?.id != null
        ? Number(foundPoc.id)
        : pId
          ? Number(pId)
          : undefined;

    const visitList = ((data as any)["visit-reports"] ?? []);
    const vId = params.visitId || params.visitReportId;
    const foundVisit = visitList.find((v: any) => {
      const opt = `VISIT ${v.nomor || v.number} - ${v.judul || v.title}`;
      return opt === selectedVisit || (vId && String(v.id) === String(vId));
    });
    const resolvedVisitReportId =
      foundVisit?.id != null
        ? Number(foundVisit.id)
        : vId
          ? Number(vId)
          : undefined;

    const isTalangan = sumberDana === "Talangan Pribadi (Reimbursement)";
    const fundingSource = isTalangan ? "TALANGAN_PRIBADI" : "PERUSAHAAN";
    const reimbursementStatus = isTalangan ? "SUBMITTED" : null;

    const row = {
      tanggal: tanggalNota,
      pelapor: user?.name || "Karyawan",
      kategori,
      nominal: numNominal,
      project: selectedProject,
      projectId: resolvedProjectId,
      survey: selectedSurvey,
      surveyId: resolvedSurveyId,
      pocReport: selectedPoc,
      pocReportId: resolvedPocReportId,
      visitReport: selectedVisit,
      visitReportId: resolvedVisitReportId,
      fundingSource,
      sumberDana,
      reimbursementStatus,
      alasan,
      status: "Dilaporkan",
      nota: photoCount > 0 || fileId ? "nota.jpg" : "-",
      fileId,
      receiptFileId: fileId ? Number(fileId) : undefined,
    };

    addRow("expenses", row);
    router.replace("/expenses");
  }

  return (
    <View className="max-w-2xl self-center w-full gap-5">
      <PageHeader
        back
        title="Catat Pengeluaran Cepat"
        subtitle="Klaim reimbursement harian, bensin, makan, atau perlengkapan lapangan"
      />

      <Panel title="Detail Pengeluaran">
        <View className="gap-4">
          <FormField label="Tanggal Pengeluaran" required>
            <DatePicker
              value={tanggalNota}
              onChange={setTanggalNota}
              placeholder="Pilih tanggal pengeluaran"
            />
          </FormField>

          <FormField label="Nominal Pengeluaran (Rp)" required>
            <Input
              value={nominal ? rupiah(numNominal) : ""}
              onChangeText={(v) => setNominal(v.replace(/\D/g, ""))}
              keyboardType="numeric"
              placeholder="Contoh: 150000"
            />
          </FormField>

          {isBig && (
            <View className="bg-warning/15 flex-row items-center gap-2 rounded-xl p-3">
              <AlertTriangle size={18} color={colors.warning} />
              <Text className="text-warning text-xs flex-1">
                Nominal di atas {rupiah(BOS_THRESHOLD)} otomatis memerlukan persetujuan tambahan dari Bos selain Finance.
              </Text>
            </View>
          )}

          <FormField label="Kategori Pengeluaran" required>
            <SearchableSelect
              value={kategori}
              onChange={setKategori}
              options={kategoriOptions}
              placeholder="Pilih kategori"
            />
          </FormField>

          <FormField label="Sumber Pendanaan" required>
            <SearchableSelect
              value={sumberDana}
              onChange={(val) => setSumberDana(val as any)}
              options={["Dana Perusahaan", "Talangan Pribadi (Reimbursement)"]}
              placeholder="Pilih sumber dana"
            />
          </FormField>

          <FormField label="Terkait Project (Opsional)">
            <SearchableSelect
              value={selectedProject}
              onChange={setCustomProject}
              options={["-", ...data.projects.map((p) => p.nama)]}
              placeholder="Pilih project jika ada"
            />
          </FormField>

          <FormField label="Terkait Survey (Opsional)">
            <SearchableSelect
              value={selectedSurvey}
              onChange={setCustomSurvey}
              options={surveyOptions}
              placeholder="Pilih survey jika ada"
            />
          </FormField>

          <FormField label="Terkait Kegiatan POC / Demo (Opsional)">
            <SearchableSelect
              value={selectedPoc}
              onChange={setCustomPoc}
              options={pocOptions}
              placeholder="Pilih kegiatan POC jika ada"
            />
          </FormField>

          <FormField label="Terkait Kunjungan / Offline Meeting (Opsional)">
            <SearchableSelect
              value={selectedVisit}
              onChange={setCustomVisit}
              options={visitOptions}
              placeholder="Pilih aktivitas kunjungan jika ada"
            />
          </FormField>

          <FormField label="Alasan / Keperluan Pengeluaran" required>
            <Textarea
              value={alasan}
              onChangeText={setAlasan}
              placeholder="Contoh: Isi bensin mobil operasional perjalanan ke lokasi Surabaya"
            />
          </FormField>
        </View>
      </Panel>

      <Panel title="Foto Bukti Nota / Struk Pembayaran" subtitle="Wajib melampirkan foto nota untuk reimbursement">
        <FileUploader
          label="Foto Nota Pembayaran"
          kind="foto"
          category="foto-struk"
          handleRef={(h) => { fileHandle.current = h; }}
          onChange={setPhotoCount}
        />
      </Panel>

      <Button size="lg" onPress={submit}>
        <Check size={18} color={colors.background} />
        <Text>Kirim Laporan Pengeluaran</Text>
      </Button>
    </View>
  );
}
