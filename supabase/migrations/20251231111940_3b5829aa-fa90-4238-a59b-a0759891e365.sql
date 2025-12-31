-- Create enum types
CREATE TYPE public.tipo_equipamento AS ENUM (
  'Casa da Mulher Brasileira',
  'Casa da Mulher Cearense',
  'Casa da Mulher Municipal',
  'Sala Lilás'
);

CREATE TYPE public.status_solicitacao AS ENUM (
  'Recebida',
  'Em análise',
  'Aprovada',
  'Em implantação',
  'Inaugurada',
  'Cancelada'
);

CREATE TYPE public.orgao_responsavel AS ENUM (
  'PMCE',
  'Guarda Municipal',
  'Outro'
);

CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'viewer',
  UNIQUE (user_id, role)
);

-- Create equipamentos table
CREATE TABLE public.equipamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio TEXT NOT NULL,
  tipo tipo_equipamento NOT NULL,
  possui_patrulha BOOLEAN NOT NULL DEFAULT false,
  endereco TEXT DEFAULT '',
  telefone TEXT DEFAULT '',
  responsavel TEXT DEFAULT '',
  observacoes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create viaturas table
CREATE TABLE public.viaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio TEXT NOT NULL,
  tipo_patrulha TEXT NOT NULL DEFAULT 'Patrulha Maria da Penha',
  vinculada_equipamento BOOLEAN NOT NULL DEFAULT false,
  equipamento_id UUID REFERENCES public.equipamentos(id) ON DELETE SET NULL,
  orgao_responsavel orgao_responsavel NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  data_implantacao DATE NOT NULL DEFAULT CURRENT_DATE,
  responsavel TEXT DEFAULT '',
  observacoes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create solicitacoes table
CREATE TABLE public.solicitacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio TEXT NOT NULL,
  data_solicitacao DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo_equipamento tipo_equipamento NOT NULL,
  status status_solicitacao NOT NULL DEFAULT 'Recebida',
  recebeu_patrulha BOOLEAN NOT NULL DEFAULT false,
  guarda_municipal_estruturada BOOLEAN NOT NULL DEFAULT false,
  kit_athena_entregue BOOLEAN NOT NULL DEFAULT false,
  capacitacao_realizada BOOLEAN NOT NULL DEFAULT false,
  suite_implantada INTEGER DEFAULT 0,
  observacoes TEXT DEFAULT '',
  anexos TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user has any role (is authenticated system user)
CREATE OR REPLACE FUNCTION public.is_system_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- Profiles RLS policies
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- User roles RLS policies (only admins can manage, users can view own)
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Equipamentos RLS policies (authenticated system users can read, admin/editor can write)
CREATE POLICY "System users can view equipamentos"
ON public.equipamentos FOR SELECT
TO authenticated
USING (public.is_system_user(auth.uid()));

CREATE POLICY "Admins and editors can insert equipamentos"
ON public.equipamentos FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Admins and editors can update equipamentos"
ON public.equipamentos FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Admins can delete equipamentos"
ON public.equipamentos FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Viaturas RLS policies
CREATE POLICY "System users can view viaturas"
ON public.viaturas FOR SELECT
TO authenticated
USING (public.is_system_user(auth.uid()));

CREATE POLICY "Admins and editors can insert viaturas"
ON public.viaturas FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Admins and editors can update viaturas"
ON public.viaturas FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Admins can delete viaturas"
ON public.viaturas FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Solicitacoes RLS policies
CREATE POLICY "System users can view solicitacoes"
ON public.solicitacoes FOR SELECT
TO authenticated
USING (public.is_system_user(auth.uid()));

CREATE POLICY "Admins and editors can insert solicitacoes"
ON public.solicitacoes FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Admins and editors can update solicitacoes"
ON public.solicitacoes FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Admins can delete solicitacoes"
ON public.solicitacoes FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.email);
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_equipamentos_updated_at
  BEFORE UPDATE ON public.equipamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_viaturas_updated_at
  BEFORE UPDATE ON public.viaturas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_solicitacoes_updated_at
  BEFORE UPDATE ON public.solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();