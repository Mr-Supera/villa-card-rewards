export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cartoes: {
        Row: {
          cliente_id: string
          codigo_nfc: string
          data_emissao: string
          estado: string
          id: string
        }
        Insert: {
          cliente_id: string
          codigo_nfc: string
          data_emissao?: string
          estado?: string
          id?: string
        }
        Update: {
          cliente_id?: string
          codigo_nfc?: string
          data_emissao?: string
          estado?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          ativo: boolean
          auth_user_id: string | null
          cartao_nfc_id: string | null
          contacto: string | null
          criado_em: string
          data_nascimento: string | null
          data_registo: string
          email: string | null
          email_contacto: string | null
          id: string
          nfc_uid: string | null
          nivel_fidelidade_id: string | null
          nome: string | null
          nome_completo: string
          saldo: number
          saldo_atual: number
          telefone: string | null
          tier: string
          total_recarregado: number
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          auth_user_id?: string | null
          cartao_nfc_id?: string | null
          contacto?: string | null
          criado_em?: string
          data_nascimento?: string | null
          data_registo?: string
          email?: string | null
          email_contacto?: string | null
          id?: string
          nfc_uid?: string | null
          nivel_fidelidade_id?: string | null
          nome?: string | null
          nome_completo?: string
          saldo?: number
          saldo_atual?: number
          telefone?: string | null
          tier?: string
          total_recarregado?: number
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          auth_user_id?: string | null
          cartao_nfc_id?: string | null
          contacto?: string | null
          criado_em?: string
          data_nascimento?: string | null
          data_registo?: string
          email?: string | null
          email_contacto?: string | null
          id?: string
          nfc_uid?: string | null
          nivel_fidelidade_id?: string | null
          nome?: string | null
          nome_completo?: string
          saldo?: number
          saldo_atual?: number
          telefone?: string | null
          tier?: string
          total_recarregado?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_cartao_nfc_id_fkey"
            columns: ["cartao_nfc_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_nivel_fidelidade_id_fkey"
            columns: ["nivel_fidelidade_id"]
            isOneToOne: false
            referencedRelation: "niveis_fidelidade"
            referencedColumns: ["id"]
          },
        ]
      }
      niveis_fidelidade: {
        Row: {
          ativo: boolean
          beneficios: string
          cor_badge: string
          criado_em: string
          desconto_percentual: number
          descricao: string | null
          id: string
          nome: string
          ordem: number
          percentagem_desconto: number
          saldo_minimo_acumulado: number
        }
        Insert: {
          ativo?: boolean
          beneficios?: string
          cor_badge?: string
          criado_em?: string
          desconto_percentual?: number
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number
          percentagem_desconto?: number
          saldo_minimo_acumulado?: number
        }
        Update: {
          ativo?: boolean
          beneficios?: string
          cor_badge?: string
          criado_em?: string
          desconto_percentual?: number
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
          percentagem_desconto?: number
          saldo_minimo_acumulado?: number
        }
        Relationships: []
      }
      pedidos_recarga: {
        Row: {
          cliente_id: string
          criado_em: string
          id: string
          metodo_preferido:
            | Database["public"]["Enums"]["metodo_pagamento"]
            | null
          processado_por: string | null
          status: Database["public"]["Enums"]["status_pedido"]
          valor_solicitado: number
        }
        Insert: {
          cliente_id: string
          criado_em?: string
          id?: string
          metodo_preferido?:
            | Database["public"]["Enums"]["metodo_pagamento"]
            | null
          processado_por?: string | null
          status?: Database["public"]["Enums"]["status_pedido"]
          valor_solicitado: number
        }
        Update: {
          cliente_id?: string
          criado_em?: string
          id?: string
          metodo_preferido?:
            | Database["public"]["Enums"]["metodo_pagamento"]
            | null
          processado_por?: string | null
          status?: Database["public"]["Enums"]["status_pedido"]
          valor_solicitado?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_recarga_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_recarga_processado_por_fkey"
            columns: ["processado_por"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          ativo: boolean
          cargo: Database["public"]["Enums"]["cargo_staff"]
          criado_em: string
          email: string
          id: string
          nome: string | null
          nome_completo: string
          role: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          cargo?: Database["public"]["Enums"]["cargo_staff"]
          criado_em?: string
          email: string
          id?: string
          nome?: string | null
          nome_completo?: string
          role?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          cargo?: Database["public"]["Enums"]["cargo_staff"]
          criado_em?: string
          email?: string
          id?: string
          nome?: string | null
          nome_completo?: string
          role?: string
          user_id?: string | null
        }
        Relationships: []
      }
      transacoes: {
        Row: {
          cliente_id: string
          criado_em: string
          desconto_aplicado: number
          descricao: string
          id: string
          metodo_pagamento:
            | Database["public"]["Enums"]["metodo_pagamento"]
            | null
          processado_por: string | null
          saldo_apos: number | null
          saldo_resultante: number
          staff_id: string | null
          timestamp: string
          tipo: Database["public"]["Enums"]["tipo_transacao"]
          valor: number
          valor_bruto: number | null
        }
        Insert: {
          cliente_id: string
          criado_em?: string
          desconto_aplicado?: number
          descricao?: string
          id?: string
          metodo_pagamento?:
            | Database["public"]["Enums"]["metodo_pagamento"]
            | null
          processado_por?: string | null
          saldo_apos?: number | null
          saldo_resultante?: number
          staff_id?: string | null
          timestamp?: string
          tipo: Database["public"]["Enums"]["tipo_transacao"]
          valor: number
          valor_bruto?: number | null
        }
        Update: {
          cliente_id?: string
          criado_em?: string
          desconto_aplicado?: number
          descricao?: string
          id?: string
          metodo_pagamento?:
            | Database["public"]["Enums"]["metodo_pagamento"]
            | null
          processado_por?: string | null
          saldo_apos?: number | null
          saldo_resultante?: number
          staff_id?: string | null
          timestamp?: string
          tipo?: Database["public"]["Enums"]["tipo_transacao"]
          valor?: number
          valor_bruto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_processado_por_fkey"
            columns: ["processado_por"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      vantagens: {
        Row: {
          ativo: boolean
          criado_em: string
          descricao: string
          id: string
          nivel_minimo_id: string | null
          nome: string
          tier_minimo: string
          tipo_desconto: string
          valor_desconto: number
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          descricao?: string
          id?: string
          nivel_minimo_id?: string | null
          nome: string
          tier_minimo?: string
          tipo_desconto?: string
          valor_desconto?: number
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          descricao?: string
          id?: string
          nivel_minimo_id?: string | null
          nome?: string
          tier_minimo?: string
          tipo_desconto?: string
          valor_desconto?: number
        }
        Relationships: [
          {
            foreignKeyName: "vantagens_nivel_minimo_id_fkey"
            columns: ["nivel_minimo_id"]
            isOneToOne: false
            referencedRelation: "niveis_fidelidade"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      atribuir_nivel: { Args: { _cliente_id: string }; Returns: undefined }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      meu_cliente_id: { Args: never; Returns: string }
      meu_staff_id: { Args: never; Returns: string }
      registar_consumo: {
        Args: { _cliente_id: string; _descricao?: string; _valor_bruto: number }
        Returns: {
          cliente_id: string
          criado_em: string
          desconto_aplicado: number
          descricao: string
          id: string
          metodo_pagamento:
            | Database["public"]["Enums"]["metodo_pagamento"]
            | null
          processado_por: string | null
          saldo_apos: number | null
          saldo_resultante: number
          staff_id: string | null
          timestamp: string
          tipo: Database["public"]["Enums"]["tipo_transacao"]
          valor: number
          valor_bruto: number | null
        }
        SetofOptions: {
          from: "*"
          to: "transacoes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registar_debito: {
        Args: { _cliente_id: string; _descricao?: string; _valor_bruto: number }
        Returns: {
          cliente_id: string
          criado_em: string
          desconto_aplicado: number
          descricao: string
          id: string
          metodo_pagamento:
            | Database["public"]["Enums"]["metodo_pagamento"]
            | null
          processado_por: string | null
          saldo_apos: number | null
          saldo_resultante: number
          staff_id: string | null
          timestamp: string
          tipo: Database["public"]["Enums"]["tipo_transacao"]
          valor: number
          valor_bruto: number | null
        }
        SetofOptions: {
          from: "*"
          to: "transacoes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registar_recarga:
        | {
            Args: { _cliente_id: string; _descricao?: string; _valor: number }
            Returns: {
              cliente_id: string
              criado_em: string
              desconto_aplicado: number
              descricao: string
              id: string
              metodo_pagamento:
                | Database["public"]["Enums"]["metodo_pagamento"]
                | null
              processado_por: string | null
              saldo_apos: number | null
              saldo_resultante: number
              staff_id: string | null
              timestamp: string
              tipo: Database["public"]["Enums"]["tipo_transacao"]
              valor: number
              valor_bruto: number | null
            }
            SetofOptions: {
              from: "*"
              to: "transacoes"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              _cliente_id: string
              _descricao?: string
              _metodo: Database["public"]["Enums"]["metodo_pagamento"]
              _valor: number
            }
            Returns: {
              cliente_id: string
              criado_em: string
              desconto_aplicado: number
              descricao: string
              id: string
              metodo_pagamento:
                | Database["public"]["Enums"]["metodo_pagamento"]
                | null
              processado_por: string | null
              saldo_apos: number | null
              saldo_resultante: number
              staff_id: string | null
              timestamp: string
              tipo: Database["public"]["Enums"]["tipo_transacao"]
              valor: number
              valor_bruto: number | null
            }
            SetofOptions: {
              from: "*"
              to: "transacoes"
              isOneToOne: true
              isSetofReturn: false
            }
          }
    }
    Enums: {
      cargo_staff: "operador" | "administrador"
      metodo_pagamento:
        | "numerario"
        | "mpesa"
        | "emola"
        | "cartao"
        | "transferencia"
      status_pedido: "pendente" | "confirmado" | "rejeitado"
      tipo_transacao: "recarga" | "debito" | "estorno" | "consumo" | "desconto"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      cargo_staff: ["operador", "administrador"],
      metodo_pagamento: [
        "numerario",
        "mpesa",
        "emola",
        "cartao",
        "transferencia",
      ],
      status_pedido: ["pendente", "confirmado", "rejeitado"],
      tipo_transacao: ["recarga", "debito", "estorno", "consumo", "desconto"],
    },
  },
} as const
