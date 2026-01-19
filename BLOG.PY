import os
import sys
import json
import base64
import tempfile
import webbrowser
from pathlib import Path
import tkinter as tk
from tkinter import ttk, messagebox, filedialog

# --- NUEVO: para imagen de avatar ---
try:
    from PIL import Image, ImageTk, ImageOps
    PIL_OK = True
except Exception:
    PIL_OK = False

# =========================
# CONFIGURACIÓN
# =========================
JSON_PATH   = r"H:\BLOG\articulos.json"
AVATAR_PATH = r"H:\BLOG\OLD\LOGO.png"     # <- TU FOTO
AVATAR_SIZE = 96                      # <- Ajusta tamaño del avatar (px)

BLOG_TITLE  = "JOSÉ MARÍA PÉREZ QUINTANA"
BLOG_BIO = (
    "Divulgo ciencia, historia, política ,filosofía y curiosidades. El propósito es aportar conocimiento, "
    "no entro en polémicas y cuando doy una opinión personal sobre algo lo advierto, pero es mi opinión "
    "no tiene porque ser una certeza. Leo los comentarios pero por norma general no los contesto. "
    "Alguien dijo una vez TODO LO QUE OIMOS ES UNA OPINIÓN NO UN HECHO, Y TODO LO QUE VEMOS ES UNA "
    "PERSPECTIVA NO LA VERDAD"
)

if not os.path.exists(JSON_PATH):
    local_json = Path(__file__).with_name("articulos.json")
    if local_json.exists():
        JSON_PATH = str(local_json)

APP_TITLE = "Gestor de Artículos del Blog"
APP_MIN_W, APP_MIN_H = 980, 560

# =========================
# UTILIDADES
# =========================
def cargar_articulos(ruta_json):
    if not os.path.exists(ruta_json):
        raise FileNotFoundError(f"No se encontró el archivo JSON: {ruta_json}")
    with open(ruta_json, "r", encoding="utf-8") as f:
        data = json.load(f)
    items = [
        {"nombre": str(x.get("nombre", "")).strip(),
         "url": str(x.get("url", "")).strip()}
        for x in data
        if isinstance(x, dict) and x.get("nombre") and x.get("url")
    ]
    items.sort(key=lambda d: d["nombre"].casefold())
    return items

def open_in_browser(url):
    try:
        webbrowser.open(url, new=2)
    except Exception as e:
        messagebox.showerror("Error al abrir", f"No se pudo abrir el navegador.\n\n{e}")

def sugerir_nombre_pdf(titulo: str) -> str:
    base = "".join(ch for ch in titulo if ch.isalnum() or ch in (" ", "-", "_")).strip()
    base = base.replace(" ", "_")[:80] or "articulo"
    return f"{base}.pdf"

def _pdf_via_chrome_devtools(url: str, destino_pdf: str) -> bool:
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        chrome_options = Options()
        chrome_options.add_argument("--headless=new")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_prefs = {
            "printing.print_preview_sticky_settings.appState": json.dumps({
                "recentDestinations": [{"id": "Save as PDF", "origin": "local"}],
                "selectedDestinationId": "Save as PDF",
                "version": 2
            }),
            "savefile.default_directory": str(Path(destino_pdf).parent)
        }
        chrome_options.add_experimental_option("prefs", chrome_prefs)
        chrome_options.add_argument("--kiosk-printing")
        driver = webdriver.Chrome(options=chrome_options)
        driver.get(url)
        pdf = driver.execute_cdp_cmd("Page.printToPDF", {
            "displayHeaderFooter": False,
            "printBackground": True,
            "landscape": False
        })
        driver.quit()
        pdf_data = base64.b64decode(pdf.get("data", b""))
        with open(destino_pdf, "wb") as f:
            f.write(pdf_data)
        return True
    except Exception:
        return False

def _pdf_via_pdfkit(url: str, destino_pdf: str) -> bool:
    try:
        import pdfkit
        pdfkit.from_url(url, destino_pdf)
        return True
    except Exception:
        return False

def archivar_url_en_pdf(url: str, destino_pdf: str) -> bool:
    if _pdf_via_chrome_devtools(url, destino_pdf):
        return True
    if _pdf_via_pdfkit(url, destino_pdf):
        return True
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        from reportlab.lib.units import cm
        c = canvas.Canvas(destino_pdf, pagesize=A4)
        width, height = A4
        text = c.beginText(2*cm, height - 2*cm)
        text.setFont("Helvetica-Bold", 14)
        text.textLine("Archivo de artículo (enlace):")
        text.setFont("Helvetica", 11)
        text.textLines(url)
        text.textLine("")
        text.setFont("Helvetica-Oblique", 9)
        text.textLine("Nota: Para guardar el contenido completo, instala Chrome+ChromeDriver o wkhtmltopdf.")
        c.drawText(text)
        c.showPage()
        c.save()
        return True
    except Exception:
        return False

def imprimir_pdf(ruta_pdf: str):
    try:
        if sys.platform.startswith("win"):
            os.startfile(ruta_pdf, "print")
        else:
            webbrowser.open(f"file://{ruta_pdf}", new=2)
    except Exception as e:
        messagebox.showerror("Error al imprimir", f"No se pudo imprimir.\n\n{e}")

# --- NUEVO: utilidades para avatar ---
def cargar_avatar_pil(path: str, size: int):
    """Devuelve ImageTk.PhotoImage redimensionado sin recortar. Si falla, devuelve None."""
    if not PIL_OK or not os.path.exists(path):
        return None
    try:
        img = Image.open(path).convert("RGBA")
        img.thumbnail((size, size), Image.Resampling.LANCZOS)  # mantiene proporción
        # Colocamos en un lienzo del tamaño exacto para que no baile
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        x = (size - img.width) // 2
        y = (size - img.height) // 2
        canvas.paste(img, (x, y))
        return ImageTk.PhotoImage(canvas)
    except Exception:
        return None

# =========================
# APLICACIÓN
# =========================
class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(APP_TITLE)
        self.minsize(APP_MIN_W, APP_MIN_H)

        self.ruta_json = JSON_PATH
        self.todos = []
        self.filtrados = []
        self.avatar_img = None  # mantener referencia

        self._configurar_estilos()
        self._construir_ui()
        self._cargar_y_refrescar()

    def _configurar_estilos(self):
        self.style = ttk.Style(self)
        if "clam" in self.style.theme_names():
            self.style.theme_use("clam")
        bg    = "#0f172a"
        panel = "#111827"
        texto = "#e5e7eb"
        acento= "#22c55e"
        self.configure(bg=bg)
        self.style.configure("TFrame", background=bg)
        self.style.configure("Panel.TFrame", background=panel)
        self.style.configure("TLabel", background=bg, foreground=texto, font=("Segoe UI", 10))
        self.style.configure("Pill.TButton", padding=8, font=("Segoe UI Semibold", 10))
        self.style.map("Pill.TButton",
                       background=[("active", "#16a34a")],
                       foreground=[("disabled", "#9ca3af")])
        self.style.configure("Search.TEntry", padding=6, foreground="#111827", fieldbackground="#f3f4f6")
        self.style.configure("URL.TEntry",    padding=6, foreground="#111827", fieldbackground="#f3f4f6")
        self.style.configure("Title.TLabel",  background=bg, foreground="#ffffff", font=("Segoe UI Semibold", 18))
        self.style.configure("Bio.TLabel",    background=bg, foreground="#cbd5e1", font=("Segoe UI", 10))

    def _construir_ui(self):
        # ===== ENCABEZADO con avatar + título + bio =====
        header = ttk.Frame(self, style="TFrame")
        header.pack(fill="x", padx=12, pady=(12, 6))

        left_head = ttk.Frame(header, style="TFrame")
        left_head.pack(side="left", padx=(0, 12))

        # Avatar
        self.avatar_img = cargar_avatar_pil(AVATAR_PATH, AVATAR_SIZE)
        if self.avatar_img is not None:
            avatar_lbl = ttk.Label(left_head, image=self.avatar_img, text="", style="TLabel")
        else:
            # Fallback: un cuadro con iniciales
            avatar_lbl = tk.Canvas(left_head, width=AVATAR_SIZE, height=AVATAR_SIZE,
                                   highlightthickness=0, bg="#0b1220")
            avatar_lbl.create_text(AVATAR_SIZE//2, AVATAR_SIZE//2,
                                   text="JM", fill="#e5e7eb", font=("Segoe UI Semibold", AVATAR_SIZE//3))
        if isinstance(avatar_lbl, ttk.Label):
            avatar_lbl.pack()
        else:
            avatar_lbl.pack()

        right_head = ttk.Frame(header, style="TFrame")
        right_head.pack(side="left", fill="x", expand=True)

        ttk.Label(right_head, text=BLOG_TITLE, style="Title.TLabel").pack(anchor="w", pady=(0, 4))
        bio_lbl = ttk.Label(right_head, text=BLOG_BIO, style="Bio.TLabel", wraplength=760, justify="left")
        bio_lbl.pack(anchor="w")

        # ===== CUERPO: izquierda (lista) / derecha (detalle) =====
        body = ttk.Frame(self, style="TFrame")
        body.pack(fill="both", expand=True, padx=12, pady=6)

        left = ttk.Frame(body, style="Panel.TFrame")
        left.pack(side="left", fill="both", expand=True, padx=(0, 6))

        right = ttk.Frame(body, style="Panel.TFrame")
        right.pack(side="left", fill="both", expand=True, padx=(6, 0))

        # --- Izquierda: búsqueda + lista ---
        top_search = ttk.Frame(left, style="Panel.TFrame")
        top_search.pack(fill="x", padx=12, pady=12)

        ttk.Label(top_search, text="Buscar artículo:").pack(anchor="w")
        self.var_busqueda = tk.StringVar(self)
        entry_buscar = ttk.Entry(top_search, textvariable=self.var_busqueda, style="Search.TEntry")
        entry_buscar.pack(fill="x", pady=(6, 0))
        entry_buscar.bind("<KeyRelease>", self._on_filtrar)

        btns = ttk.Frame(top_search, style="Panel.TFrame")
        btns.pack(fill="x", pady=(10, 0))
        ttk.Button(btns, text="Nueva búsqueda", style="Pill.TButton",
                   command=self._nueva_busqueda).pack(side="left")
        ttk.Button(btns, text="Cerrar búsqueda", style="Pill.TButton",
                   command=self._cerrar_busqueda).pack(side="left", padx=8)
        ttk.Button(btns, text="Cargar otro JSON", style="Pill.TButton",
                   command=self._cargar_otro_json).pack(side="left")

        list_frame = ttk.Frame(left, style="Panel.TFrame")
        list_frame.pack(fill="both", expand=True, padx=12, pady=(6, 12))

        self.listbox = tk.Listbox(list_frame, activestyle="dotbox", selectmode="browse",
                                  bg="#0b1220", fg="#e5e7eb", relief="flat",
                                  highlightthickness=0, selectbackground="#1e293b",
                                  font=("Segoe UI", 10))
        scrollbar = ttk.Scrollbar(list_frame, orient="vertical", command=self.listbox.yview)
        self.listbox.configure(yscrollcommand=scrollbar.set)
        self.listbox.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="left", fill="y")
        self.listbox.bind("<<ListboxSelect>>", self._on_seleccionar)

        # --- Derecha: detalle / acciones ---
        right_inner = ttk.Frame(right, style="Panel.TFrame")
        right_inner.pack(fill="both", expand=True, padx=12, pady=12)

        ttk.Label(right_inner, text="Artículo seleccionado:").pack(anchor="w")
        self.var_titulo = tk.StringVar(self)
        ttk.Label(right_inner, textvariable=self.var_titulo, font=("Segoe UI Semibold", 12)).pack(anchor="w", pady=(0,8))

        ttk.Label(right_inner, text="URL:").pack(anchor="w")
        self.var_url = tk.StringVar(self)
        self.entry_url = ttk.Entry(right_inner, textvariable=self.var_url, style="URL.TEntry")
        self.entry_url.pack(fill="x", pady=(4, 12))

        actions = ttk.Frame(right_inner, style="Panel.TFrame")
        actions.pack(fill="x")
        ttk.Button(actions, text="Ver artículo", style="Pill.TButton",
                   command=self._ver_articulo).pack(side="left")
        ttk.Button(actions, text="Archivar en PDF", style="Pill.TButton",
                   command=self._archivar_pdf).pack(side="left", padx=8)
        ttk.Button(actions, text="Imprimir", style="Pill.TButton",
                   command=self._imprimir).pack(side="left")

        # Estado
        self.var_estado = tk.StringVar(self, value=f"JSON: {self.ruta_json}")
        status = ttk.Label(self, textvariable=self.var_estado, anchor="w")
        status.pack(fill="x", padx=12, pady=(6, 12))

    # =========================
    # LÓGICA
    # =========================
    def _cargar_y_refrescar(self):
        try:
            self.todos = cargar_articulos(self.ruta_json)
            self._aplicar_filtro()
            self.var_estado.set(f"Cargados {len(self.todos)} artículos | JSON: {self.ruta_json}")
        except Exception as e:
            messagebox.showerror("Error al cargar JSON", str(e))
            self.var_estado.set("Error al cargar JSON")

    def _aplicar_filtro(self):
        q = self.var_busqueda.get().strip().casefold()
        if q:
            self.filtrados = [x for x in self.todos if q in x["nombre"].casefold()]
        else:
            self.filtrados = list(self.todos)
        self._repoblar_listbox()

    def _repoblar_listbox(self):
        self.listbox.delete(0, tk.END)
        for item in self.filtrados:
            self.listbox.insert(tk.END, item["nombre"])

    def _on_filtrar(self, event=None):
        self._aplicar_filtro()

    def _nueva_busqueda(self):
        self.var_busqueda.set("")
        self._aplicar_filtro()
        self.listbox.selection_clear(0, tk.END)
        self.var_titulo.set("")
        self.var_url.set("")
        self.var_estado.set("Nueva búsqueda preparada")

    def _cerrar_busqueda(self):
        self.listbox.selection_clear(0, tk.END)
        self.var_titulo.set("")
        self.var_url.set("")
        self.var_estado.set("Búsqueda cerrada (selección limpia)")

    def _cargar_otro_json(self):
        ruta = filedialog.askopenfilename(
            title="Selecciona un archivo JSON",
            filetypes=[("JSON", "*.json"), ("Todos", "*.*")]
        )
        if ruta:
            self.ruta_json = ruta
            self._cargar_y_refrescar()

    def _on_seleccionar(self, event=None):
        sel = self.listbox.curselection()
        if not sel:
            return
        idx = sel[0]
        item = self.filtrados[idx]
        self.var_titulo.set(item["nombre"])
        self.var_url.set(item["url"])
        self.var_estado.set(f"Seleccionado: {item['nombre']}")

    def _ver_articulo(self):
        url = self.var_url.get().strip()
        if not url:
            messagebox.showinfo("Sin URL", "Selecciona un artículo primero.")
            return
        open_in_browser(url)

    def _archivar_pdf(self):
        url = self.var_url.get().strip()
        titulo = self.var_titulo.get().strip()
        if not url:
            messagebox.showinfo("Sin URL", "Selecciona un artículo primero.")
            return
        sugerido = sugerir_nombre_pdf(titulo or "articulo")
        destino = filedialog.asksaveasfilename(
            title="Guardar como PDF",
            defaultextension=".pdf",
            initialfile=sugerido,
            filetypes=[("PDF", "*.pdf")]
        )
        if not destino:
            return
        self.var_estado.set("Generando PDF…")
        self.update_idletasks()
        ok = archivar_url_en_pdf(url, destino)
        if ok:
            self.var_estado.set(f"PDF guardado: {destino}")
            messagebox.showinfo("PDF guardado", f"Se guardó el PDF:\n{destino}")
        else:
            self.var_estado.set("No se pudo generar el PDF")
            messagebox.showerror(
                "Fallo al archivar",
                "No se pudo generar el PDF.\n\n"
                "Sugerencias:\n"
                "  • Instala Google Chrome y ChromeDriver (misma versión)\n"
                "  • pip install selenium==4\n"
                "  • O instala wkhtmltopdf y pip install pdfkit\n"
                "  • Vuelve a intentarlo."
            )

    def _imprimir(self):
        url = self.var_url.get().strip()
        titulo = self.var_titulo.get().strip()
        if not url:
            messagebox.showinfo("Sin URL", "Selecciona un artículo primero.")
            return
        tmpdir = tempfile.gettempdir()
        tmp_pdf = os.path.join(tmpdir, sugerir_nombre_pdf(titulo or "articulo_tmp"))
        if archivar_url_en_pdf(url, tmp_pdf):
            imprimir_pdf(tmp_pdf)
            self.var_estado.set("Enviado a impresión (o abierto para imprimir).")
        else:
            messagebox.showerror(
                "No se pudo imprimir",
                "No se pudo generar el PDF para imprimir.\nRevisa dependencias (Chrome/ChromeDriver o wkhtmltopdf)."
            )

def main():
    app = App()
    app.mainloop()

if __name__ == "__main__":
    main()
