-- Create regional goals table for storing monthly goals with history
CREATE TABLE public.regional_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  regiao TEXT NOT NULL,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  meta_equipamentos INTEGER NOT NULL DEFAULT 5,
  meta_viaturas INTEGER NOT NULL DEFAULT 10,
  meta_cobertura NUMERIC(5,2) NOT NULL DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Ensure unique goal per region/month
  CONSTRAINT unique_regional_goal_month UNIQUE (regiao, ano, mes)
);

-- Enable Row Level Security
ALTER TABLE public.regional_goals ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view regional goals" 
  ON public.regional_goals 
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Editors and admins can create regional goals" 
  ON public.regional_goals 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "Editors and admins can update regional goals" 
  ON public.regional_goals 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "Only admins can delete regional goals" 
  ON public.regional_goals 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Create index for faster queries
CREATE INDEX idx_regional_goals_month ON public.regional_goals(ano, mes);
CREATE INDEX idx_regional_goals_regiao ON public.regional_goals(regiao);

-- Create updated_at trigger
CREATE TRIGGER update_regional_goals_updated_at
  BEFORE UPDATE ON public.regional_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();