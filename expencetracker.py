from datetime import date, datetime, timedelta
import streamlit as st
import sqlite3
import pandas as pd
import uuid
from datetime import datetime, date, timedelta
import calendar
from decimal import Decimal
import io
import csv

# Page config
st.set_page_config(
    page_title="Expense Tracker",
    page_icon="💰",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for calm, minimal design
st.markdown("""
<style>
    .main {
        padding: 2rem 1rem;
    }
    
    .metric-card {
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        padding: 1.5rem;
        border-radius: 16px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        margin-bottom: 1rem;
    }
    
    .metric-value {
        font-size: 2rem;
        font-weight: 600;
        color: #1e293b;
        margin: 0;
    }
    
    .metric-label {
        font-size: 0.875rem;
        color: #64748b;
        margin: 0;
    }
    
    .success-metric {
        background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
        border-color: #bbf7d0;
    }
    
    .warning-metric {
        background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
        border-color: #fcd34d;
    }
    
    .alert-card {
        background: #fef3c7;
        border-left: 4px solid #f59e0b;
        padding: 1rem;
        margin: 1rem 0;
        border-radius: 8px;
    }
    
    .stButton button {
        border-radius: 12px;
        border: none;
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        color: white;
        padding: 0.5rem 1rem;
        font-weight: 500;
    }
    
    .sidebar .stSelectbox {
        margin-bottom: 1rem;
    }
    
    div[data-testid="stMetricValue"] {
        font-size: 1.8rem;
        font-weight: 600;
    }
    
    .bill-ending-soon {
        background: #fef3c7;
        padding: 0.25rem 0.5rem;
        border-radius: 8px;
        font-size: 0.75rem;
        color: #92400e;
        margin-left: 0.5rem;
    }
    
    .due-badge {
        background: #dbeafe;
        padding: 0.25rem 0.5rem;
        border-radius: 8px;
        font-size: 0.75rem;
        color: #1e40af;
    }
    
    .past-due-badge {
        background: #fee2e2;
        padding: 0.25rem 0.5rem;
        border-radius: 8px;
        font-size: 0.75rem;
        color: #dc2626;
    }
</style>
""", unsafe_allow_html=True)

# Database setup
def init_database():
    conn = sqlite3.connect('expense_tracker.db')
    cursor = conn.cursor()
    
    # Bills table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bills (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            amount_monthly DECIMAL(10,2) DEFAULT 0.00,
            balance_outstanding DECIMAL(10,2) DEFAULT 0.00,
            due_day INTEGER,
            start_date DATE,
            end_date DATE,
            payment_method TEXT DEFAULT 'manual',
            funding_account TEXT,
            payment_frequency TEXT DEFAULT 'monthly',
            category TEXT,
            notes TEXT,
            is_active BOOLEAN DEFAULT 1,
            last_paid_on DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Incomes table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS incomes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            amount_net_monthly DECIMAL(10,2) NOT NULL,
            pay_day INTEGER,
            funding_account TEXT,
            notes TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Transactions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            date DATE NOT NULL,
            type TEXT NOT NULL,
            linked_bill_id TEXT,
            amount DECIMAL(10,2) NOT NULL,
            account TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (linked_bill_id) REFERENCES bills(id)
        )
    ''')
    
    # Settings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')
    
    # Insert default settings
    cursor.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ('currency_symbol', '£'))
    cursor.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ('first_day_of_month', '1'))
    
    conn.commit()
    conn.close()

def get_settings():
    conn = sqlite3.connect('expense_tracker.db')
    cursor = conn.cursor()
    cursor.execute('SELECT key, value FROM settings')
    settings = dict(cursor.fetchall())
    conn.close()
    return settings

def seed_data():
    conn = sqlite3.connect('expense_tracker.db')
    cursor = conn.cursor()
    
    # Check if data already exists
    cursor.execute('SELECT COUNT(*) FROM bills')
    count = cursor.fetchone()[0]
    
    if count == 0:
        seed_bills = [
            ('Rent', 2150.00, 0.00, 1, 'Housing', 'debit_order'),
            ('Giffgaff', 0.00, 0.00, None, 'Mobile', 'manual'),
            ('Netflix', 15.99, 0.00, None, 'Entertainment', 'card'),
            ('Spotify', 9.99, 0.00, None, 'Entertainment', 'card'),
            ('Aqua CC', 73.28, 0.00, None, 'Debt', 'card'),
            ('Classic CC', 189.21, 0.00, None, 'Debt', 'card'),
            ('Fluid CC', 380.00, 0.00, None, 'Debt', 'card'),
            ('Microsoft', 7.99, 0.00, None, 'Software', 'card'),
            ('Hart DC', 330.00, 0.00, None, 'Debt', 'manual'),
            ('RCI Fin', 313.00, 0.00, None, 'Debt', 'manual'),
            ('Octopus Energy', 263.00, 0.00, 15, 'Utilities', 'debit_order'),
            ('Tesco Mobile', 35.00, 0.00, None, 'Mobile', 'card'),
            ('Virgin Mobile', 34.39, 0.00, None, 'Mobile', 'card'),
            ('DVLA – RE06OVH', 0.00, 0.00, None, 'Vehicle', 'manual'),
            ('DVLA – HN21AMO', 14.43, 0.00, None, 'Vehicle', 'manual'),
            ('TV Licence', 13.25, 0.00, None, 'Household', 'debit_order'),
            ('Capitol 1 CC', 10.00, 0.00, None, 'Debt', 'card'),
            ('Google Play', 7.99, 0.00, None, 'Software', 'card'),
            ('Audible', 7.99, 0.00, None, 'Entertainment', 'card'),
            ('Apple.com', 6.99, 0.00, None, 'Software', 'card'),
            ('Apple.com', 4.99, 0.00, None, 'Software', 'card'),
            ('Creation', 71.63, 0.00, None, 'Debt', 'card'),
            ('Kids Pass', 2.99, 0.00, None, 'Entertainment', 'card'),
            ('Taxsense', 0.00, 0.00, None, 'Professional', 'manual'),
            ('Virgin Media', 44.00, 0.00, None, 'Internet/TV', 'debit_order'),
            ('Advantis', 184.00, 0.00, None, 'Debt', 'manual'),
            ('Past Due', 260.00, 260.00, None, 'Debt', 'manual'),
            ('Admiral Insurance', 88.00, 0.00, None, 'Insurance', 'debit_order'),
            ('Vodafone Its device', 0.00, 0.00, None, 'Mobile/Device', 'manual'),
            ('Prime TV', 6.99, 0.00, None, 'Entertainment', 'card'),
        ]
        
        for name, amount, balance, due_day, category, payment_method in seed_bills:
            bill_id = str(uuid.uuid4())
            cursor.execute('''
                INSERT INTO bills 
                (id, name, amount_monthly, balance_outstanding, due_day, category, payment_method, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            ''', (bill_id, name, amount, balance, due_day, category, payment_method))
        
        # Add sample income
        income_id = str(uuid.uuid4())
        cursor.execute('''
            INSERT INTO incomes 
            (id, name, amount_net_monthly, pay_day, funding_account, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (income_id, 'Salary (Net)', 3500.00, 28, 'Main', 1))
    
    conn.commit()
    conn.close()

def _to_date(value):
    """Accepts None/NaN/str/date/datetime and returns a date or None."""
    try:
        import pandas as pd  # local import to avoid issues if top-level import changes
    except Exception:
        pass
    # Treat None/NaN as missing
    try:
        import pandas as pd
        if value is None or pd.isna(value):
            return None
    except Exception:
        if value is None:
            return None
    from datetime import datetime, date
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    # assume ISO-like string
    try:
        return datetime.strptime(str(value), '%Y-%m-%d').date()
    except Exception:
        # try more flexible parse if available
        try:
            from dateutil import parser
            return parser.parse(str(value)).date()
        except Exception:
            return None

def calculate_next_due_date(due_day, last_paid_on, payment_frequency, start_date, end_date):
    import pandas as pd
    from datetime import date, timedelta, datetime
    import calendar

    # --- normalise due_day ---
    if due_day is None:
        return None
    try:
        if pd.isna(due_day):
            return None
    except Exception:
        pass
    try:
        due_day = int(float(due_day))   # handle "15", 15.0, "15.0"
    except (TypeError, ValueError):
        return None
    due_day = max(1, min(due_day, 31))

    # --- normalise dates ---
    last_paid_on = _to_date(last_paid_on)
    start_date   = _to_date(start_date)
    end_date     = _to_date(end_date)

    today = date.today()

    if str(payment_frequency).lower() == 'monthly':
        if last_paid_on:
            # first day of the month after last_paid_on
            next_month = (last_paid_on.replace(day=1) + timedelta(days=32)).replace(day=1)
        else:
            # this month (first day)
            next_month = today.replace(day=1)

        # choose a valid day within that month
        last_dom = calendar.monthrange(next_month.year, next_month.month)[1]
        day = min(due_day, last_dom)
        next_due = next_month.replace(day=day)

        # if that date is not in the future, move to the next month
        if next_due <= today:
            nm = (next_due.replace(day=1) + timedelta(days=32)).replace(day=1)
            last_dom = calendar.monthrange(nm.year, nm.month)[1]
            next_due = nm.replace(day=min(due_day, last_dom))

        # apply optional date window
        if start_date and next_due < start_date:
            return None
        if end_date and next_due > end_date:
            return None

        return next_due.strftime('%Y-%m-%d')

    # Add other frequency rules here if needed (weekly, yearly, etc.)
    return None
def get_bills_data():
    conn = sqlite3.connect('expense_tracker.db')
    query = '''
        SELECT id, name, amount_monthly, balance_outstanding, due_day, start_date, end_date,
               payment_method, funding_account, payment_frequency, category, notes, 
               is_active, last_paid_on
        FROM bills 
        ORDER BY name
    '''
    df = pd.read_sql_query(query, conn)
    conn.close()
    
    # Ensure due_day is numeric (nullable)
    df['due_day'] = pd.to_numeric(df.get('due_day'), errors='coerce')
    # Calculate next due dates
    df['next_due_on'] = df.apply(lambda row: calculate_next_due_date(
        row['due_day'], row['last_paid_on'], row['payment_frequency'], 
        row['start_date'], row['end_date']
    ), axis=1)
    
    return df

def get_incomes_data():
    conn = sqlite3.connect('expense_tracker.db')
    query = 'SELECT * FROM incomes ORDER BY name'
    df = pd.read_sql_query(query, conn)
    conn.close()
    return df

def save_bill(bill_data, bill_id=None):
    conn = sqlite3.connect('expense_tracker.db')
    cursor = conn.cursor()
    
    if bill_id:
        cursor.execute('''
            UPDATE bills SET 
            name=?, amount_monthly=?, balance_outstanding=?, due_day=?, start_date=?, end_date=?,
            payment_method=?, funding_account=?, payment_frequency=?, category=?, notes=?, is_active=?
            WHERE id=?
        ''', (*bill_data, bill_id))
    else:
        bill_id = str(uuid.uuid4())
        cursor.execute('''
            INSERT INTO bills 
            (id, name, amount_monthly, balance_outstanding, due_day, start_date, end_date,
             payment_method, funding_account, payment_frequency, category, notes, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (bill_id, *bill_data))
    
    conn.commit()
    conn.close()
    return bill_id

def delete_bill(bill_id):
    conn = sqlite3.connect('expense_tracker.db')
    cursor = conn.cursor()
    cursor.execute('DELETE FROM bills WHERE id=?', (bill_id,))
    conn.commit()
    conn.close()

def save_income(income_data, income_id=None):
    conn = sqlite3.connect('expense_tracker.db')
    cursor = conn.cursor()
    
    if income_id:
        cursor.execute('''
            UPDATE incomes SET 
            name=?, amount_net_monthly=?, pay_day=?, funding_account=?, notes=?, is_active=?
            WHERE id=?
        ''', (*income_data, income_id))
    else:
        income_id = str(uuid.uuid4())
        cursor.execute('''
            INSERT INTO incomes 
            (id, name, amount_net_monthly, pay_day, funding_account, notes, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (income_id, *income_data))
    
    conn.commit()
    conn.close()
    return income_id

def mark_bill_paid(bill_id):
    conn = sqlite3.connect('expense_tracker.db')
    cursor = conn.cursor()
    
    today = date.today().strftime('%Y-%m-%d')
    
    # Update last_paid_on
    cursor.execute('UPDATE bills SET last_paid_on=? WHERE id=?', (today, bill_id))
    
    # Create transaction record
    trans_id = str(uuid.uuid4())
    cursor.execute('''
        INSERT INTO transactions (id, date, type, linked_bill_id, amount, notes)
        SELECT ?, ?, 'payment', ?, amount_monthly, 'Marked as paid'
        FROM bills WHERE id=?
    ''', (trans_id, today, bill_id, bill_id))
    
    conn.commit()
    conn.close()

# Initialize app
init_database()
seed_data()
settings = get_settings()

# Sidebar navigation
st.sidebar.title("💰 Expense Tracker")
page = st.sidebar.selectbox("Navigate", ["Dashboard", "Bills", "Income", "Transactions", "Export"])

if page == "Dashboard":
    st.title("📊 Dashboard")

    # Get data
    bills_df = get_bills_data()
    incomes_df = get_incomes_data()

    # Metrics
    total_income = incomes_df[incomes_df['is_active'] == 1]['amount_net_monthly'].sum()
    total_bills = bills_df[bills_df['is_active'] == 1]['amount_monthly'].sum()
    net_leftover = total_income - total_bills
    total_outstanding = bills_df['balance_outstanding'].sum()

    # Normalize "today" to midnight and use pandas Timedelta for comparisons
    today_ts = pd.Timestamp.today().normalize()

    # Top metrics cards
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Monthly Income", f"{settings['currency_symbol']}{total_income:,.2f}")
    with col2:
        st.metric("Monthly Bills", f"{settings['currency_symbol']}{total_bills:,.2f}")
    with col3:
        st.metric("Net Leftover", f"{settings['currency_symbol']}{net_leftover:,.2f}")
    with col4:
        st.metric("Total Outstanding", f"{settings['currency_symbol']}{total_outstanding:,.2f}")

    st.markdown("---")

    # Alerts section
    alerts = []

    # Prepare parsed dates once
    end_dt = pd.to_datetime(bills_df.get('end_date'), errors='coerce')
    next_due_dt = pd.to_datetime(bills_df.get('next_due_on'), errors='coerce')

    # Bills ending soon (within 90 days)
    ending_soon = bills_df[
        bills_df['is_active'].eq(1) &
        end_dt.notna() &
        (end_dt <= today_ts + pd.Timedelta(days=90))
    ]
    if not ending_soon.empty:
        alerts.append("📅 Bills ending soon: " + ", ".join(ending_soon['name'].tolist()))

    # Past due bills (next_due_on before today)
    past_due = bills_df[
        bills_df['is_active'].eq(1) &
        next_due_dt.notna() &
        (next_due_dt < today_ts)
    ]
    if not past_due.empty:
        alerts.append("⚠️ Past due: " + ", ".join(past_due['name'].tolist()))

    # Upcoming bills (next 30 days)
    upcoming = bills_df[
        bills_df['is_active'].eq(1) &
        next_due_dt.notna() &
        (next_due_dt <= today_ts + pd.Timedelta(days=30)) &
        (next_due_dt >= today_ts)
    ]

    if not ending_soon.empty or not past_due.empty or not upcoming.empty:
        st.subheader("Alerts")
        for a in alerts:
            st.info(a)
        if not upcoming.empty:
            st.info("🔔 Due soon (30 days): " + ", ".join(upcoming['name'].tolist()))
    else:
        st.info("No upcoming bills in the next 30 days.")

    else:
        if alerts:
            st.subheader("Alerts")
            for a in alerts:
                st.info(a)
        else:
            st.info("No upcoming bills in the next 30 days.")

                else:
                    st.write(f"In {days_until} days")
    else:
        st.info("No bills due in the next 30 days")
    
    # Category breakdown
    if not bills_df.empty:
        st.markdown("### 📊 Bills by Category")
        category_totals = bills_df[bills_df['is_active'] == 1].groupby('category')['amount_monthly'].sum().sort_values(ascending=False)
        
        for category, amount in category_totals.head(10).items():
            percentage = (amount / total_bills * 100) if total_bills > 0 else 0
            st.write(f"**{category}**: {settings['currency_symbol']}{amount:,.2f} ({percentage:.1f}%)")

elif page == "Bills":
    st.title("📝 Bills Management")
    
    # Quick filters
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        show_inactive = st.checkbox("Show inactive")
    with col2:
        filter_zero = st.checkbox("Show £0 items only")
    with col3:
        filter_debts = st.checkbox("Debts only")
    with col4:
        search_term = st.text_input("Search bills", placeholder="Search by name...")
    
    # Get bills data
    bills_df = get_bills_data()
    
    # Apply filters
    if not show_inactive:
        bills_df = bills_df[bills_df['is_active'] == 1]
    if filter_zero:
        bills_df = bills_df[bills_df['amount_monthly'] == 0]
    if filter_debts:
        bills_df = bills_df[bills_df['category'] == 'Debt']
    if search_term:
        bills_df = bills_df[bills_df['name'].str.contains(search_term, case=False, na=False)]
    
    # Add new bill button
    if st.button("➕ Add New Bill", type="primary"):
        st.session_state.show_bill_form = True
        st.session_state.edit_bill_id = None
    
    # Display bills
    if not bills_df.empty:
        for _, bill in bills_df.iterrows():
            with st.container():
                col1, col2, col3, col4, col5, col6 = st.columns([3, 1.5, 1.5, 1, 1, 1])
                
                with col1:
                    bill_name = bill['name']
                    if bill['end_date'] and pd.notna(bill['end_date']):
                        end_date = datetime.strptime(bill['end_date'], '%Y-%m-%d').date()
                        if end_date <= date.today() + timedelta(days=90):
                            bill_name += " 🟡"
                    st.write(f"**{bill_name}**")
                    if bill['category']:
                        st.caption(bill['category'])
                
                with col2:
                    st.write(f"{settings['currency_symbol']}{bill['amount_monthly']:,.2f}")
                
                with col3:
                    if bill['balance_outstanding'] > 0:
                        st.write(f"{settings['currency_symbol']}{bill['balance_outstanding']:,.2f}")
                    else:
                        st.write("-")
                
                with col4:
                    if bill['due_day']:
                        st.write(f"Day {bill['due_day']}")
                    else:
                        st.write("-")
                
                with col5:
                    if st.button("ℹ️", key=f"info_{bill['id']}", help="View details"):
                        st.session_state.show_bill_form = True
                        st.session_state.edit_bill_id = bill['id']
                
                with col6:
                    if st.button("✅", key=f"paid_{bill['id']}", help="Mark as paid"):
                        mark_bill_paid(bill['id'])
                        st.rerun()
                
                st.markdown("---")
    else:
        st.info("No bills found. Try adjusting your filters or add a new bill.")
    
    # Bill form modal
    if st.session_state.get('show_bill_form', False):
        st.markdown("### Bill Details")
        
        # Get existing bill data if editing
        if st.session_state.get('edit_bill_id'):
            existing_bill = bills_df[bills_df['id'] == st.session_state.edit_bill_id].iloc[0]
        else:
            existing_bill = None
        
        with st.form("bill_form"):
            col1, col2 = st.columns(2)
            
            with col1:
                name = st.text_input("Bill Name", value=existing_bill['name'] if existing_bill is not None else "")
                amount = st.number_input("Monthly Amount", min_value=0.0, step=0.01, 
                                       value=float(existing_bill['amount_monthly']) if existing_bill is not None else 0.0)
                balance = st.number_input("Balance Outstanding", min_value=0.0, step=0.01,
                                        value=float(existing_bill['balance_outstanding']) if existing_bill is not None else 0.0)
                due_day = st.number_input("Due Day (1-31)", min_value=1, max_value=31, value=existing_bill['due_day'] if existing_bill is not None and existing_bill['due_day'] else 1)
                
            with col2:
                payment_method = st.selectbox("Payment Method", 
                                            ["manual", "debit_order", "card", "transfer", "cash", "other"],
                                            index=["manual", "debit_order", "card", "transfer", "cash", "other"].index(existing_bill['payment_method']) if existing_bill is not None and existing_bill['payment_method'] else 0)
                category = st.text_input("Category", value=existing_bill['category'] if existing_bill is not None else "")
                funding_account = st.text_input("Funding Account", value=existing_bill['funding_account'] if existing_bill is not None else "")
                is_active = st.checkbox("Active", value=bool(existing_bill['is_active']) if existing_bill is not None else True)
            
            notes = st.text_area("Notes", value=existing_bill['notes'] if existing_bill is not None else "")
            
            col1, col2, col3 = st.columns(3)
            with col1:
                if st.form_submit_button("Save Bill", type="primary"):
                    bill_data = (name, amount, balance, due_day if due_day else None, None, None, 
                               payment_method, funding_account, "monthly", category, notes, is_active)
                    
                    if st.session_state.get('edit_bill_id'):
                        save_bill(bill_data, st.session_state.edit_bill_id)
                    else:
                        save_bill(bill_data)
                    
                    st.session_state.show_bill_form = False
                    st.rerun()
            
            with col2:
                if st.form_submit_button("Cancel"):
                    st.session_state.show_bill_form = False
                    st.rerun()
            
            with col3:
                if existing_bill is not None and st.form_submit_button("Delete Bill", type="secondary"):
                    delete_bill(st.session_state.edit_bill_id)
                    st.session_state.show_bill_form = False
                    st.rerun()

elif page == "Income":
    st.title("💰 Income Management")
    
    # Get income data
    incomes_df = get_incomes_data()
    
    # Add new income button
    if st.button("➕ Add New Income", type="primary"):
        st.session_state.show_income_form = True
        st.session_state.edit_income_id = None
    
    # Display incomes
    if not incomes_df.empty:
        for _, income in incomes_df.iterrows():
            with st.container():
                col1, col2, col3, col4 = st.columns([3, 2, 1, 1])
                
                with col1:
                    st.write(f"**{income['name']}**")
                    if income['funding_account']:
                        st.caption(f"Account: {income['funding_account']}")
                
                with col2:
                    st.write(f"{settings['currency_symbol']}{income['amount_net_monthly']:,.2f}")
                
                with col3:
                    if income['pay_day']:
                        st.write(f"Day {income['pay_day']}")
                    else:
                        st.write("-")
                
                with col4:
                    if st.button("Edit", key=f"edit_income_{income['id']}"):
                        st.session_state.show_income_form = True
                        st.session_state.edit_income_id = income['id']
                
                st.markdown("---")
    else:
        st.info("No income sources found. Add your first income source.")
    
    # Income form
    if st.session_state.get('show_income_form', False):
        st.markdown("### Income Details")
        
        # Get existing income data if editing
        if st.session_state.get('edit_income_id'):
            existing_income = incomes_df[incomes_df['id'] == st.session_state.edit_income_id].iloc[0]
        else:
            existing_income = None
        
        with st.form("income_form"):
            col1, col2 = st.columns(2)
            
            with col1:
                name = st.text_input("Income Name", value=existing_income['name'] if existing_income is not None else "")
                amount = st.number_input("Net Monthly Amount", min_value=0.0, step=0.01,
                                       value=float(existing_income['amount_net_monthly']) if existing_income is not None else 0.0)
            
            with col2:
                pay_day = st.number_input("Pay Day (1-31)", min_value=1, max_value=31, 
                                        value=existing_income['pay_day'] if existing_income is not None and existing_income['pay_day'] else 1)
                funding_account = st.text_input("Account", value=existing_income['funding_account'] if existing_income is not None else "")
            
            notes = st.text_area("Notes", value=existing_income['notes'] if existing_income is not None else "")
            is_active = st.checkbox("Active", value=bool(existing_income['is_active']) if existing_income is not None else True)
            
            col1, col2, col3 = st.columns(3)
            with col1:
                if st.form_submit_button("Save Income", type="primary"):
                    income_data = (name, amount, pay_day if pay_day else None, funding_account, notes, is_active)
                    
                    if st.session_state.get('edit_income_id'):
                        save_income(income_data, st.session_state.edit_income_id)
                    else:
                        save_income(income_data)
                    
                    st.session_state.show_income_form = False
                    st.rerun()
            
            with col2:
                if st.form_submit_button("Cancel"):
                    st.session_state.show_income_form = False
                    st.rerun()

elif page == "Transactions":
    st.title("📊 Transaction History")
    
    conn = sqlite3.connect('expense_tracker.db')
    query = '''
        SELECT t.*, b.name as bill_name 
        FROM transactions t
        LEFT JOIN bills b ON t.linked_bill_id = b.id
        ORDER BY t.date DESC
    '''
    transactions_df = pd.read_sql_query(query, conn)
    conn.close()
    
    if not transactions_df.empty:
        st.dataframe(
            transactions_df[['date', 'type', 'bill_name', 'amount', 'account', 'notes']],
            use_container_width=True
        )
    else:
        st.info("No transactions recorded yet. Transactions are created when you mark bills as paid.")

elif page == "Export":
    st.title("💾 Export & Backup")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("### Export Data")
        
        if st.button("📊 Export Bills to CSV"):
            bills_df = get_bills_data()
            csv_buffer = io.StringIO()
            bills_df.to_csv(csv_buffer, index=False)
            
            st.download_button(
                label="Download Bills CSV",
                data=csv_buffer.getvalue(),
                file_name=f"bills_export_{date.today().strftime('%Y%m%d')}.csv",
                mime="text/csv"
            )
        
        if st.button("💰 Export Income to CSV"):
            incomes_df = get_incomes_data()
            csv_buffer = io.StringIO()
            incomes_df.to_csv(csv_buffer, index=False)
            
            st.download_button(
                label="Download Income CSV",
                data=csv_buffer.getvalue(),
                file_name=f"income_export_{date.today().strftime('%Y%m%d')}.csv",
                mime="text/csv"
            )
    
    with col2:
        st.markdown("### Import Data")
        
        uploaded_file = st.file_uploader("Import Bills CSV", type=['csv'])
        
        if uploaded_file is not None:
            try:
                df = pd.read_csv(uploaded_file)
                st.write("Preview of imported data:")
                st.dataframe(df.head())
                
                if st.button("Import Bills"):
                    try:
                        with get_db_connection() as conn:
                            cursor = conn.cursor()
                            
                            imported_count = 0
                            for _, row in df.iterrows():
                                bill_id = str(uuid.uuid4())
                                cursor.execute('''
                                    INSERT INTO bills (id, name, amount_monthly, category, is_active)
                                    VALUES (?, ?, ?, ?, 1)
                                ''', (bill_id, row.get('name', ''), row.get('amount_monthly', 0), row.get('category', '')))
                                imported_count += 1
                            
                            conn.commit()
                            st.success(f"Successfully imported {imported_count} bills!")
                            st.rerun()
                    except Exception as e:
                        st.error(f"Error importing data: {str(e)}")
                    
            except Exception as e:
                st.error(f"Error importing file: {str(e)}")

# Initialize session state
if 'show_bill_form' not in st.session_state:
    st.session_state.show_bill_form = False
if 'show_income_form' not in st.session_state:
    st.session_state.show_income_form = False
