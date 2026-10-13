import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, FileSpreadsheet, Loader, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import FileUploader from "@/components/FileUploader";
import { processExcelFile } from "@/services/excelImportService";
import { getProducts } from "@/services/productService";
import { applyProductUpdate } from "@/services/productUpdateService";
import { FIELD_LABELS, planProductUpdates, type FieldChange, type UpdatePlan } from "@/lib/productUpdatePlan";

const formatValue = (change: FieldChange, value: string) =>
  value === "" ? "—" : change.field === "price" ? `$${Number(value).toFixed(2)}` : value;

const CodeList: React.FC<{ title: string; codes: string[]; tone?: string }> = ({ title, codes, tone = "text-muted-foreground" }) =>
  codes.length > 0 ? (
    <p className={`text-sm ${tone}`}>
      <span className="font-medium">{title} ({codes.length}):</span> {codes.join(", ")}
    </p>
  ) : null;

const UpdateFromExcel: React.FC = () => {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<UpdatePlan | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ updated: number; failed: string[] } | null>(null);

  const totalChanges = useMemo(
    () => plan?.updates.filter((u) => selected.has(u.product.id)).reduce((sum, u) => sum + u.changes.length, 0) ?? 0,
    [plan, selected]
  );

  const check = async (file: File) => {
    setChecking(true);
    setPlan(null);
    setResult(null);
    try {
      const [sheet, existing] = await Promise.all([processExcelFile(file, { withImages: false }), getProducts(undefined, false)]);
      const next = planProductUpdates(sheet, existing);
      setPlan(next);
      setSelected(new Set(next.updates.map((u) => u.product.id)));
      if (next.updates.length === 0) toast.info("Everything in this sheet already matches the app.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't read the Excel file");
    } finally {
      setChecking(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const apply = async () => {
    if (!plan) return;
    const chosen = plan.updates.filter((u) => selected.has(u.product.id));
    setApplying(true);
    setProgress(0);
    const failed: string[] = [];
    for (let i = 0; i < chosen.length; i++) {
      try {
        await applyProductUpdate(chosen[i]);
      } catch {
        failed.push(chosen[i].product.product_code);
      }
      setProgress(Math.round(((i + 1) / chosen.length) * 100));
    }
    setApplying(false);
    setResult({ updated: chosen.length - failed.length, failed });
    setPlan(null);
    if (failed.length) toast.error(`${failed.length} products could not be updated`);
    else toast.success(`Updated ${chosen.length} products`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Update existing products from Excel
        </CardTitle>
        <CardDescription>
          Upload a revised price list or offersheet. Products are matched by item code and you can review every change
          before it is saved. Blank cells never erase existing details; packing size, net weight, photos and QR codes stay as they are.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FileUploader onFileSelect={check} accept=".xlsx,.xls" maxSize={100} label="Upload updated Excel file" isLoading={checking} />

        {checking && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader className="h-4 w-4 animate-spin" /> Comparing the sheet with your products…
          </p>
        )}

        {result && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4" /> {result.updated} products updated.</p>
            {result.failed.length > 0 && <p className="mt-1 text-red-700">Failed: {result.failed.join(", ")}</p>}
          </div>
        )}

        {plan && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span><b>{plan.updates.length}</b> products with changes</span>
              <span><b>{plan.unchanged}</b> already up to date</span>
            </div>
            <CodeList title="Not in the app (ignored)" codes={plan.notFound} tone="text-amber-700" />
            <CodeList title="Listed twice in the sheet (first row used)" codes={plan.duplicateCodes} tone="text-amber-700" />
            <CodeList title="Still without a price" codes={plan.stillWithoutPrice} />

            {plan.updates.length > 0 && (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id="select-all-updates"
                    checked={selected.size === plan.updates.length}
                    onCheckedChange={(checked) =>
                      setSelected(checked === true ? new Set(plan.updates.map((u) => u.product.id)) : new Set())
                    }
                  />
                  <label htmlFor="select-all-updates">Select all</label>
                </div>
                <div className="max-h-[420px] overflow-y-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted text-left">
                      <tr>
                        <th className="w-10 p-2" />
                        <th className="p-2">Item code</th>
                        <th className="p-2">Changes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.updates.map(({ product, changes }) => (
                        <tr key={product.id} className="border-t align-top">
                          <td className="p-2">
                            <Checkbox checked={selected.has(product.id)} onCheckedChange={() => toggle(product.id)} />
                          </td>
                          <td className="p-2">
                            <p className="font-medium">{product.product_code}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{product.description}</p>
                          </td>
                          <td className="p-2 space-y-0.5">
                            {changes.map((change) => (
                              <p key={change.field}>
                                <span className="text-muted-foreground">{FIELD_LABELS[change.field]}:</span>{" "}
                                <span className="line-through text-muted-foreground">{formatValue(change, change.from)}</span>{" "}
                                → <b>{formatValue(change, change.to)}</b>
                              </p>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {applying && <Progress value={progress} className="h-2" />}
      </CardContent>
      {((plan && plan.updates.length > 0) || result) && (
        <CardFooter className="justify-end gap-3">
          {result && <Button variant="outline" onClick={() => navigate("/products")}>View products</Button>}
          {plan && plan.updates.length > 0 && (
            <Button onClick={apply} disabled={applying || selected.size === 0}>
              {applying ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              Update {selected.size} products ({totalChanges} changes)
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
};

export default UpdateFromExcel;
