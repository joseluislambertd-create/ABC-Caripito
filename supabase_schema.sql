-- ==============================================================================
-- ACADEMIA DE BALONCESTO CARIPITO (ABC) - ESQUEMA DE BASE DE DATOS EN LA NUBE
-- Plataforma: Supabase / PostgreSQL (Idempotente / Re-ejecutable)
-- ==============================================================================

-- 1. Crear extensión para UUIDs (si no existe)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Crear Tabla de Atletas
CREATE TABLE IF NOT EXISTS public.atletas (
    id VARCHAR(50) PRIMARY KEY,                         -- Ej: ATL-001, ATL-002
    fecha_ingreso DATE DEFAULT CURRENT_DATE,
    nombres VARCHAR(120) NOT NULL,
    apellidos VARCHAR(120) NOT NULL,
    cedula VARCHAR(50) NOT NULL,
    fecha_nac DATE,
    edad INTEGER NOT NULL,
    peso NUMERIC(5, 2) NOT NULL,                        -- Peso en kg
    estatura NUMERIC(4, 2) NOT NULL,                    -- Estatura en metros (ej: 1.75)
    imc NUMERIC(4, 1),                                  -- Índice de Masa Corporal
    salud TEXT DEFAULT 'Sin novedades médicas',         -- Alergias, condiciones médicas
    tipo_sangre VARCHAR(10) DEFAULT 'O+',
    posicion VARCHAR(60) DEFAULT 'Formativo',
    categoria VARCHAR(30) DEFAULT 'U-18',
    dorsal VARCHAR(20) DEFAULT 'S/N',
    representante VARCHAR(150) NOT NULL,
    parentesco VARCHAR(50) NOT NULL,                    -- Padre, Madre, Tutor
    telefono_rep VARCHAR(50) NOT NULL,
    telefono_emergencia VARCHAR(50),
    direccion TEXT DEFAULT 'Caripito, Edo. Monagas',
    foto TEXT,                                          -- URL o Base64 de la fotografía
    estatus VARCHAR(30) DEFAULT 'Activo',               -- Activo, En Evaluación, Lesionado, Inactivo
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Índices para Búsquedas Rápidas y Filtrado de Categoría / Estatus
CREATE INDEX IF NOT EXISTS idx_atletas_categoria ON public.atletas(categoria);
CREATE INDEX IF NOT EXISTS idx_atletas_estatus ON public.atletas(estatus);
CREATE INDEX IF NOT EXISTS idx_atletas_cedula ON public.atletas(cedula);

-- 4. Habilitar Seguridad por Fila (Row Level Security - RLS)
ALTER TABLE public.atletas ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de Acceso (Con DROP previo para permitir re-ejecución sin errores)

-- Política 1: Lectura Pública
DROP POLICY IF EXISTS "Permitir lectura publica de atletas" ON public.atletas;
CREATE POLICY "Permitir lectura publica de atletas"
ON public.atletas FOR SELECT
USING (true);

-- Política 2: Inserción Pública (Representantes)
DROP POLICY IF EXISTS "Permitir insercion publica de nuevos atletas" ON public.atletas;
CREATE POLICY "Permitir insercion publica de nuevos atletas"
ON public.atletas FOR INSERT
WITH CHECK (true);

-- Política 3: Actualización
DROP POLICY IF EXISTS "Permitir actualizacion de atletas" ON public.atletas;
CREATE POLICY "Permitir actualizacion de atletas"
ON public.atletas FOR UPDATE
USING (true)
WITH CHECK (true);

-- Política 4: Eliminación
DROP POLICY IF EXISTS "Permitir eliminacion de atletas" ON public.atletas;
CREATE POLICY "Permitir eliminacion de atletas"
ON public.atletas FOR DELETE
USING (true);

-- 6. Función y Trigger para Actualizar updated_at Automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_atletas_updated_at ON public.atletas;
CREATE TRIGGER trigger_atletas_updated_at
    BEFORE UPDATE ON public.atletas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Inserción de Datos Iniciales (Seed Data de la Academia ABC)
INSERT INTO public.atletas (
    id, fecha_ingreso, nombres, apellidos, cedula, fecha_nac, edad, peso, estatura, imc, 
    salud, tipo_sangre, posicion, categoria, dorsal, representante, parentesco, 
    telefono_rep, telefono_emergencia, direccion, foto, estatus
) VALUES 
('ATL-001', '2025-01-15', 'Carlos Eduardo', 'Mendoza Pérez', 'V-30.123.456', '2008-05-12', 18, 68.5, 1.75, 22.4, 'Sin novedades médicas', 'O+', 'Base / Armador', 'U-18', '7', 'Roberto Mendoza', 'Padre', '0414-1234567', '0424-7654321', 'Sector Centro, Caripito', 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&auto=format&fit=crop&q=80', 'Activo'),
('ATL-002', '2025-01-20', 'Sofía Valentina', 'Gómez Rivas', 'V-31.456.789', '2009-08-24', 17, 54.0, 1.62, 20.6, 'Alergia a la Penicilina', 'A+', 'Escolta', 'U-18', '11', 'Elena Rivas', 'Madre', '0412-9876543', '0416-5554433', 'Sector La Sabana, Caripito', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80', 'Activo'),
('ATL-003', '2025-02-01', 'Erick José', 'Lambert Silva', 'V-29.876.543', '2007-11-03', 18, 72.0, 1.82, 21.7, 'Sin novedades médicas', 'O+', 'Alero', 'U-18', '23', 'José Lambert', 'Padre', '0424-1112233', '0414-9998877', 'Sector El Rincón, Caripito', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80', 'Activo'),
('ATL-004', '2025-02-10', 'Mariana Isabel', 'Torres Castro', 'V-32.111.222', '2010-03-15', 16, 48.0, 1.58, 19.2, 'Asma leve (Usa Inhalador)', 'B+', 'Base / Armador', 'U-16', '4', 'Carmen Castro', 'Madre', '0416-3334455', '0412-7778899', 'Sector Las Parcelas, Caripito', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80', 'Activo'),
('ATL-005', '2025-03-05', 'Gabriel Alejandro', 'Rojas Rondón', 'V-30.555.444', '2008-09-30', 17, 76.5, 1.80, 23.6, 'Esguince de tobillo derecho previo (Recuperado)', 'O-', 'Ala-Pívot', 'U-18', '15', 'Manuel Rojas', 'Padre', '0414-8889900', '0424-3332211', 'Sector Caripe Viejo, Caripito', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80', 'Activo'),
('ATL-006', '2025-03-12', 'Luis Fernando', 'Díaz Morales', 'V-29.444.333', '2007-04-18', 19, 81.0, 1.85, 23.7, 'Sin novedades médicas', 'AB+', 'Pívot', 'U-21', '33', 'Fernando Díaz', 'Padre', '0426-1237890', '0414-4561234', 'Sector El Bajo, Caripito', 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&auto=format&fit=crop&q=80', 'Activo'),
('ATL-007', '2025-03-20', 'Camila Alejandra', 'Navarro Salazar', 'V-31.888.999', '2009-12-05', 16, 52.0, 1.64, 19.3, 'Alergia al polvillo', 'A-', 'Escolta', 'U-16', '8', 'Patricia Salazar', 'Madre', '0414-7776655', '0412-1110022', 'Sector Los Mangos, Caripito', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80', 'En Evaluación'),
('ATL-008', '2025-04-02', 'Jesús David', 'Hernández Brito', 'V-32.444.111', '2010-07-22', 15, 59.0, 1.68, 20.9, 'Sin novedades médicas', 'O+', 'Formativo', 'U-16', '10', 'David Hernández', 'Padre', '0416-9990011', '0424-6665544', 'Sector Bella Vista, Caripito', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80', 'Activo')
ON CONFLICT (id) DO NOTHING;
