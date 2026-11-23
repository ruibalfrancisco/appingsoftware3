"""Textos de los emails, en español rioplatense (RNF-14)."""

from html import escape

from app.correo import Mensaje


def _html(titulo: str, parrafo: str, boton: str, enlace: str, pie: str) -> str:
    enlace_seguro = escape(enlace, quote=True)
    return f"""\
<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;color:#0F172A">
  <h1 style="font-size:22px">{escape(titulo)}</h1>
  <p style="font-size:15px;line-height:1.5">{escape(parrafo)}</p>
  <p><a href="{enlace_seguro}" style="display:inline-block;background:#0F766E;color:#fff;
     padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600">
     {escape(boton)}</a></p>
  <p style="font-size:13px;color:#475569">{escape(pie)}</p>
</div>"""


def email_de_verificacion(para: str, nombre: str, enlace: str) -> Mensaje:
    parrafo = f"Hola {nombre}: para empezar a reportar reclamos, confirmá tu email."
    pie = "El enlace vence en 24 horas. Si no creaste una cuenta, ignorá este mensaje."
    return Mensaje(
        para=para,
        asunto="Confirmá tu email · Reclamos Villa Allende",
        texto=f"{parrafo}\n\n{enlace}\n\n{pie}\n",
        html=_html("Confirmá tu email", parrafo, "Confirmar email", enlace, pie),
    )


def email_de_recuperacion(para: str, nombre: str, enlace: str) -> Mensaje:
    parrafo = f"Hola {nombre}: pediste cambiar tu contraseña."
    pie = (
        "El enlace vence en 1 hora. Si no lo pediste, ignorá este mensaje: tu contraseña no cambia."
    )
    return Mensaje(
        para=para,
        asunto="Cambiá tu contraseña · Reclamos Villa Allende",
        texto=f"{parrafo}\n\n{enlace}\n\n{pie}\n",
        html=_html("Cambiá tu contraseña", parrafo, "Elegir contraseña nueva", enlace, pie),
    )
