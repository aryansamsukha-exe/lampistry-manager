import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileSpreadsheet, Loader, Store, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Product } from "@/components/ProductCard";
import { processExcelFile } from "@/services/excelImportService";
import {
  createShowroomCollection, deleteShowroomCollection, getShowroomCollections,
  type ImportProgress, type ShowroomCollection,
} from "@/services/showroomService";

const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const nameFromFile = (fileName: string) => fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();

const Showroom: React.FC = () => {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<ShowroomCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Product[] | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [toDelete, setToDelete] = useState<ShowroomCollection | null>(null);

  const load = () =>
    getShowroomCollections()
      .then(setCollections)
      .catch((err) => {
        console.error(err);
        toast.error("Could not load showroom collections. Has supabase/showroom.sql been run?");
      })
      .finally(() => setIsLoading(false));

  useEffect(() => { load(); }, []);

  const handleFile = async (selected: File | null) => {
    setFile(selected);
    setRows(null);
    if (!selected) return;
    setName((current) => current || nameFromFile(selected.name));
    setIsReading(true);
    try {
      setRows(await processExcelFile(selected, { requireCode: false }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read the Excel file.");
      setFile(null);
    } finally {
      setIsReading(false);
    }
  };

  const handleImport = async () => {
    if (!rows?.length || !name.trim()) return;
    setProgress({ done: 0, total: 0 });
    try {
      const id = await createShowroomCollection(
        { name, clientName, sourceFileName: file?.name, rows },
        setProgress
      );
      toast.success(`Imported ${rows.length} products.`);
      navigate(`/showroom/${id}`);
    } catch (err) {
      console.error(err);
      toast.error("Import failed. Nothing was saved.");
      setProgress(null);
    }
  };

  const handleDelete = async (collection: ShowroomCollection) => {
    try {
      await deleteShowroomCollection(collection.id);
      setCollections((list) => list.filter((c) => c.id !== collection.id));
      toast.success("Collection deleted.");
    } catch {
      toast.error("Could not delete the collection.");
    }
    setToDelete(null);
  };

  const withPhoto = rows?.filter((r) => r.imageUrl).length ?? 0;
  const withoutPrice = rows?.filter((r) => !(r.price > 0)).length ?? 0;
  const withoutCode = rows?.filter((r) => !r.product_code).length ?? 0;
  const isImporting = progress !== null;

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      <main className="container px-4 py-8 space-y-8 max-w-5xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Showroom</h1>
          <p className="text-muted-foreground mt-1">
            Price cards for products displayed in clients' showrooms. These collections are kept separate from your
            own products, catalogues and QR pages.
          </p>
        </div>

        <section className="rounded-xl border bg-white p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Upload className="h-4 w-4" /> New showroom collection</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="sm:col-span-3">
              <Label htmlFor="showroom-file">Offersheet (Excel)</Label>
              <Input
                id="showroom-file"
                type="file"
                accept=".xlsx,.xls"
                className="mt-1.5 bg-stone-50"
                disabled={isImporting}
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="showroom-name">Collection name *</Label>
              <Input id="showroom-name" className="mt-1.5" value={name} disabled={isImporting}
                onChange={(e) => setName(e.target.value)} placeholder="Imperial Art showroom – Oct 2026" />
            </div>
            <div>
              <Label htmlFor="showroom-client">Client</Label>
              <Input id="showroom-client" className="mt-1.5" value={clientName} disabled={isImporting}
                onChange={(e) => setClientName(e.target.value)} placeholder="Imperial Art" />
            </div>
          </div>

          {isReading && (
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader className="h-4 w-4 animate-spin" /> Reading the sheet…</p>
          )}
          {rows && (
            <div className="rounded-lg bg-stone-50 border px-4 py-3 text-sm space-y-1">
              <p className="font-medium flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> {rows.length} products found</p>
              <p className="text-muted-foreground">
                {withPhoto} with a photo · {rows.length - withoutPrice} with a price
                {withoutCode > 0 && ` · ${withoutCode} without an item code`}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={handleImport} disabled={!rows?.length || !name.trim() || isImporting}>
              {isImporting ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {isImporting
                ? progress.total ? `Uploading photos ${progress.done}/${progress.total}…` : "Saving…"
                : "Import collection"}
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold">Collections</h2>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader className="h-6 w-6 animate-spin text-stone-400" /></div>
          ) : collections.length === 0 ? (
            <div className="rounded-xl border border-dashed py-14 text-center text-muted-foreground">
              <Store className="h-10 w-10 mx-auto mb-2 text-stone-300" />
              No showroom collections yet. Import an offersheet above.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {collections.map((c) => (
                <div key={c.id} className="rounded-xl border bg-white p-5 flex items-start justify-between gap-3">
                  <Link to={`/showroom/${c.id}`} className="min-w-0 flex-1 group">
                    <h3 className="font-semibold group-hover:underline truncate">{c.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {c.client_name ? `${c.client_name} · ` : ""}{c.item_count} products · {fmtDate(c.created_at)}
                    </p>
                  </Link>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => navigate(`/showroom/${c.id}`)}>Open</Button>
                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setToDelete(c)} aria-label={`Delete ${c.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{toDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the showroom collection and its photos. Your own products are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => toDelete && handleDelete(toDelete)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Showroom;
