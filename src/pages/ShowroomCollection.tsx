import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ImageOff, ImagePlus, Loader, Pencil, Plus, Printer, RotateCcw, RotateCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CARDS_PER_SHEET, ShowroomCardSheets } from "@/components/showroom/ShowroomCardSheets";
import { waitForCatalogAssets } from "@/components/catalog/CatalogDocument";
import { cardTitle, formatCardPrice, formatCardSize } from "@/lib/showroomCard";
import { compressImage, rotateImage } from "@/services/imageCompression";
import {
  addShowroomItem, deleteShowroomItem, getShowroomCollection, setShowroomItemPhoto, updateShowroomItem,
  type ShowroomItem,
} from "@/services/showroomService";

type EditForm = { product_code: string; description: string; finish: string; length: string; width: string; height: string; price: string };

const EMPTY_FORM: EditForm = { product_code: "", description: "", finish: "", length: "", width: "", height: "", price: "" };

/** The item being edited, or "new" when adding a product that was not in the sheet. */
type EditTarget = ShowroomItem | "new" | null;

const toForm = (item: ShowroomItem): EditForm => ({
  product_code: item.product_code ?? "",
  description: item.description ?? "",
  finish: item.finish ?? "",
  length: item.length ?? "",
  width: item.width ?? "",
  height: item.height ?? "",
  price: item.price === null ? "" : String(item.price),
});

const ShowroomCollection: React.FC = () => {
  const { collectionId = "" } = useParams();
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("");
  const [client, setClient] = useState<string | null>(null);
  const [items, setItems] = useState<ShowroomItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [query, setQuery] = useState("");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EditTarget>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [isPhotoBusy, setIsPhotoBusy] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);

  useEffect(() => {
    getShowroomCollection(collectionId)
      .then((result) => {
        if (!result) { setStatus("missing"); return; }
        setTitle(result.collection.name);
        setClient(result.collection.client_name);
        setItems(result.items);
        setStatus("ready");
      })
      .catch((err) => {
        console.error(err);
        toast.error("Could not load the collection.");
        setStatus("missing");
      });
  }, [collectionId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      [i.product_code, i.description, i.finish].some((v) => v?.toLowerCase().includes(q))
    );
  }, [items, query]);

  const toPrint = useMemo(() => items.filter((i) => !excluded.has(i.id)), [items, excluded]);
  const sheetCount = Math.ceil(toPrint.length / CARDS_PER_SHEET);

  const toggle = (id: string) =>
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const setAllVisible = (include: boolean) =>
    setExcluded((current) => {
      const next = new Set(current);
      visible.forEach((i) => (include ? next.delete(i.id) : next.add(i.id)));
      return next;
    });

  const openEditor = (target: ShowroomItem | "new") => {
    setEditing(target);
    setForm(target === "new" ? EMPTY_FORM : toForm(target));
    setPhoto(target === "new" ? null : target.image_url);
    setPhotoChanged(false);
  };
  const setField = (key: keyof EditForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => (f ? { ...f, [key]: e.target.value } : f));

  const handleRotate = async (quarterTurns: number) => {
    if (!photo) return;
    setIsPhotoBusy(true);
    try {
      setPhoto(await rotateImage(photo, quarterTurns));
      setPhotoChanged(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not rotate the photo.");
    } finally {
      setIsPhotoBusy(false);
    }
  };

  const handlePhotoFile = async (file: File | undefined) => {
    if (!file) return;
    setIsPhotoBusy(true);
    try {
      const dataUrl = await compressImage(file);
      if (!dataUrl) throw new Error("This file could not be read. Use a JPG or PNG photo.");
      setPhoto(dataUrl);
      setPhotoChanged(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load the photo.");
    } finally {
      setIsPhotoBusy(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!editing || !form) return;
    const price = form.price.trim() === "" ? null : Number(form.price);
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      toast.warning("Enter a valid price, or leave it empty.");
      return;
    }
    if (editing === "new" && !form.description.trim() && !form.product_code.trim()) {
      toast.warning("Enter a description or an item code.");
      return;
    }
    setIsSaving(true);
    try {
      if (editing === "new") {
        const added = await addShowroomItem(collectionId, { ...form, price }, photoChanged ? photo : null);
        setItems((list) => [...list, added]);
        toast.success("Product added.");
      } else {
        let updated = await updateShowroomItem(editing.id, { ...form, price });
        if (photoChanged && photo) updated = await setShowroomItemPhoto(updated, photo);
        setItems((list) => list.map((i) => (i.id === updated.id ? updated : i)));
        toast.success("Saved.");
      }
      setEditing(null);
    } catch (err) {
      console.error(err);
      toast.error("Could not save the changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: ShowroomItem) => {
    if (!window.confirm(`Remove “${cardTitle(item) || "this product"}” from the collection?`)) return;
    try {
      await deleteShowroomItem(item);
      setItems((list) => list.filter((i) => i.id !== item.id));
    } catch {
      toast.error("Could not remove the product.");
    }
  };

  const handlePrint = async () => {
    setIsPreparingPrint(true);
    try {
      await waitForCatalogAssets(printAreaRef.current);
    } finally {
      setIsPreparingPrint(false);
    }
    window.print();
  };

  if (status !== "ready") {
    return (
      <div className="min-h-screen bg-stone-50">
        <Navbar />
        <main className="container px-4 py-16 text-center text-muted-foreground">
          {status === "loading" ? <Loader className="h-6 w-6 animate-spin mx-auto" /> : (
            <>
              <p className="mb-4">This showroom collection was not found.</p>
              <Button asChild variant="outline"><Link to="/showroom">Back to Showroom</Link></Button>
            </>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 print:min-h-0 print:bg-white">
      <style>{`@media print { html, body { background: white !important; } .no-print { display: none !important; } }`}</style>
      <div className="no-print"><Navbar /></div>

      <main className="container px-4 py-8 print:p-0 print:max-w-none">
        <div className="no-print space-y-4 mb-8">
          <Link to="/showroom" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-1" /> Showroom
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
              <p className="text-muted-foreground mt-1">
                {client ? `${client} · ` : ""}{items.length} products · Price cards 99 × 68 mm, {CARDS_PER_SHEET} per A4 sheet
              </p>
            </div>
            <Button onClick={handlePrint} disabled={toPrint.length === 0 || isPreparingPrint} className="gap-2">
              {isPreparingPrint ? <Loader className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              {isPreparingPrint ? "Loading photos…" : `Print ${toPrint.length} cards (${sheetCount} ${sheetCount === 1 ? "sheet" : "sheets"})`}
            </Button>
          </div>

          <div className="rounded-lg border bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b px-4 py-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={visible.length > 0 && visible.every((i) => !excluded.has(i.id))}
                  onCheckedChange={(checked) => setAllVisible(checked === true)}
                />
                Print all
              </label>
              <div className="flex items-center gap-2">
                <div className="relative sm:w-72">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9 h-9" placeholder="Search code, description, finish…" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                <Button size="sm" variant="outline" className="h-9" onClick={() => openEditor("new")}>
                  <Plus className="h-4 w-4 mr-1" /> Add product
                </Button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y">
              {visible.map((item) => {
                const size = formatCardSize(item);
                const price = formatCardPrice(item.price);
                return (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <Checkbox checked={!excluded.has(item.id)} onCheckedChange={() => toggle(item.id)} aria-label="Print this card" />
                    <button
                      type="button"
                      onClick={() => openEditor(item)}
                      title="Change or rotate photo"
                      className="h-12 w-12 flex-shrink-0 rounded border bg-white overflow-hidden flex items-center justify-center hover:ring-2 hover:ring-primary/40"
                    >
                      {item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-contain" /> : <ImageOff className="h-4 w-4 text-stone-300" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {item.product_code && <span className="font-mono mr-2">{item.product_code}</span>}
                        {cardTitle(item)}
                      </p>
                      <p className="text-muted-foreground truncate">
                        {[item.finish, size].filter(Boolean).join(" · ") || "No finish or size"}
                      </p>
                    </div>
                    <span className={`w-16 text-right font-semibold ${price ? "" : "text-amber-600 font-normal"}`}>{price ?? "No price"}</span>
                    <Button size="icon" variant="ghost" onClick={() => openEditor(item)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(item)} aria-label="Remove">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            When printing, choose A4, margins "None", scale 100% and turn on "Background graphics"; turn off "Headers and footers".
          </p>
        </div>

        <div ref={printAreaRef} className="overflow-x-auto print:overflow-visible">
          <ShowroomCardSheets items={toPrint} />
        </div>
      </main>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add product" : "Edit card"}</DialogTitle>
            <DialogDescription>Changes apply only to this showroom collection.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid grid-cols-3 gap-3 py-2">
              <div className="col-span-3 flex gap-3 items-center">
                <div className="h-28 w-28 flex-shrink-0 rounded border bg-white overflow-hidden flex items-center justify-center">
                  {isPhotoBusy ? <Loader className="h-5 w-5 animate-spin text-stone-400" />
                    : photo ? <img src={photo} alt="" className="h-full w-full object-contain" />
                    : <ImageOff className="h-6 w-6 text-stone-300" />}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" disabled={!photo || isPhotoBusy} onClick={() => handleRotate(-1)}>
                      <RotateCcw className="h-4 w-4 mr-1" /> Left
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={!photo || isPhotoBusy} onClick={() => handleRotate(1)}>
                      <RotateCw className="h-4 w-4 mr-1" /> Right
                    </Button>
                  </div>
                  <Button type="button" size="sm" variant="outline" disabled={isPhotoBusy} onClick={() => photoInputRef.current?.click()}>
                    <ImagePlus className="h-4 w-4 mr-1" /> {photo ? "Change photo" : "Add photo"}
                  </Button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePhotoFile(e.target.files?.[0])}
                  />
                </div>
              </div>
              <div className="col-span-3">
                <Label>Description</Label>
                <Input className="mt-1" value={form.description} onChange={setField("description")} />
              </div>
              <div className="col-span-2">
                <Label>Item code</Label>
                <Input className="mt-1" value={form.product_code} onChange={setField("product_code")} />
              </div>
              <div>
                <Label>Price (USD)</Label>
                <Input className="mt-1" type="number" min="0" step="0.01" value={form.price} onChange={setField("price")} />
              </div>
              <div className="col-span-3">
                <Label>Finish</Label>
                <Input className="mt-1" value={form.finish} onChange={setField("finish")} />
              </div>
              <div><Label>Length</Label><Input className="mt-1" value={form.length} onChange={setField("length")} /></div>
              <div><Label>Width</Label><Input className="mt-1" value={form.width} onChange={setField("width")} /></div>
              <div><Label>Height</Label><Input className="mt-1" value={form.height} onChange={setField("height")} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving || isPhotoBusy}>
              {isSaving && <Loader className="h-4 w-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShowroomCollection;
