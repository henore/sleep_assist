import sqlite3
from datetime import datetime, timedelta
import asyncio
import threading
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
from tkcalendar import Calendar


class DatabaseManager:
    def __init__(self, db_name='data2.db'):
        self.db_name = db_name

    def execute_query(self, query, params=None):
        conn = None
        try:
            conn = sqlite3.connect(self.db_name)
            cursor = conn.cursor()
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            conn.commit()
            return cursor.fetchall()
        except sqlite3.Error as e:
            print(f"Database error: {e}")
            return None
        finally:
            if conn:
                conn.close()

    def create_tables(self):
        sleep_records_table = '''CREATE TABLE IF NOT EXISTS sleep_records
            (id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            sleep_time TEXT,
            wake_time TEXT,
            sleep_duration TEXT,
            sleep_satisfaction INTEGER,
            sleep_quality INTEGER,
            sleep_dissatisfaction INTEGER,
            sleep_anxiety INTEGER,
            sleep_preparation TEXT,
            sleep_reflection TEXT,
            advice_history_id INTEGER)'''

        advice_history_table = '''CREATE TABLE IF NOT EXISTS advice_history
            (id INTEGER PRIMARY KEY,
            advice TEXT,
            date TEXT,
            FOREIGN KEY(id) REFERENCES sleep_records(id))'''

        user_profiles_table = '''CREATE TABLE IF NOT EXISTS user_profiles
            (id INTEGER PRIMARY KEY AUTOINCREMENT,
            nickname TEXT,
            sleep_medication TEXT,
            medication_reduction TEXT,
            advice_intensity TEXT)'''

        cbt_info_table = '''CREATE TABLE IF NOT EXISTS cbt_info
            (id INTEGER PRIMARY KEY,
            content TEXT)'''

        self.execute_query(sleep_records_table)
        self.execute_query(advice_history_table)
        self.execute_query(user_profiles_table)
        self.execute_query(cbt_info_table)
        print("All tables created successfully")
    
    @staticmethod
    def get_advice_for_recent_records(conn):
        seven_days_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        cursor = conn.cursor()
        cursor.execute("""
            SELECT sr.*, ah.advice 
            FROM sleep_records sr
            LEFT JOIN advice_history ah ON sr.date = ah.date
            WHERE sr.date >= ?
            ORDER BY sr.date DESC
        """, (seven_days_ago,))
        return cursor.fetchall()
    
    def get_all_advice_dates(self):
        query = "SELECT DISTINCT date FROM advice_history"
        result = self.execute_query(query)
        return [date[0] for date in result]

class UserProfileManager:
    def __init__(self, db_manager):
        self.db_manager = db_manager

    def get_user_profile(self, user_id):
        query = "SELECT * FROM user_profiles WHERE id = ?"
        result = self.db_manager.execute_query(query, (user_id,))
        if result:
            user_data = result[0]
            return {
                'id': user_data[0],
                'nickname': user_data[1],
                'sleep_medication': user_data[2],
                'medication_reduction': user_data[3],
                'advice_intensity': user_data[4]
            }
        return None

    def save_user_profile(self, profile):
        query = '''INSERT OR REPLACE INTO user_profiles 
                   (id, nickname, sleep_medication, medication_reduction, advice_intensity) 
                   VALUES (?, ?, ?, ?, ?)'''
        self.db_manager.execute_query(query, (
            profile['id'],
            profile['nickname'],
            profile['sleep_medication'],
            profile['medication_reduction'],
            profile['advice_intensity']
        ))
        print(f"Saved user profile: {profile}")

    def create_new_profile(self, user_id):
        new_profile = {
            'id': user_id,
            'nickname': "",
            'sleep_medication': "使用していない",
            'medication_reduction': "該当なし",
            'advice_intensity': "ライト"
        }
        self.save_user_profile(new_profile)
        print(f"Created new user profile: {new_profile}")
        return new_profile

    def is_profile_complete(self, profile):
        return all([
            profile['nickname'],
            profile['sleep_medication'],
            profile['medication_reduction'],
            profile['advice_intensity']
        ])

class SleepRecordManager:
    def __init__(self, db_manager, ai_advice_manager):
        self.db_manager = db_manager
        self.ai_advice_manager = ai_advice_manager

    def get_sleep_records(self, start_date, end_date):
        query = '''SELECT * FROM sleep_records 
                   WHERE date BETWEEN ? AND ? 
                   ORDER BY date DESC'''
        return self.db_manager.execute_query(query, (start_date, end_date))

    def save_sleep_record(self, record):
        query = '''INSERT INTO sleep_records 
                   (date, sleep_time, wake_time, sleep_duration, 
                   sleep_satisfaction, sleep_quality, sleep_dissatisfaction, sleep_anxiety,
                   sleep_preparation, sleep_reflection)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'''
        self.db_manager.execute_query(query, (
            record['date'],
            record['sleep_time'],
            record['wake_time'],
            record['sleep_duration'],
            record['sleep_satisfaction'],
            record['sleep_quality'],
            record['sleep_dissatisfaction'],
            record['sleep_anxiety'],
            record['sleep_preparation'],
            record['sleep_reflection']
        ))
        print(f"Saved sleep record for date: {record['date']}")

    def get_recent_records(self, days=7):
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        records = self.get_sleep_records(start_date, end_date)
        return records if records else []
    
    def get_recent_records_with_advice(self, days=7, user_profile=None):
        recent_records = self.get_recent_records(days)
        advice_list = []

        for record in recent_records:
            advice = self.fetch_advice_for_record(record)
            record_with_advice = record + (advice,)  # 助言をタプルに追加
            advice_list.append(record_with_advice)

        return advice_list

    def fetch_advice_for_record(self, record):
        record_date = record[1]  # recordのdateフィールド
        advice_history = self.db_manager.execute_query(
            "SELECT advice FROM advice_history WHERE date = ?",
            (record_date,)
        )
        return advice_history[0][0] if advice_history else None

    def delete_record(self, record_id):
        query = "DELETE FROM sleep_records WHERE id = ?"
        self.db_manager.execute_query(query, (record_id,))
        print(f"Deleted sleep record with ID: {record_id}")

    def update_advice_id(self, sleep_record_id, advice_id):
        query = "UPDATE sleep_records SET advice_history_id = ? WHERE id = ?"
        self.db_manager.execute_query(query, (advice_id, sleep_record_id))
        print(f"Updated advice ID for sleep record: {sleep_record_id}")

    def calculate_sleep_duration(self, sleep_time, wake_time):
        time_format = "%Y-%m-%d %H:%M:%S"

        try:
            sleep_datetime = datetime.strptime(sleep_time, time_format)
            wake_datetime = datetime.strptime(wake_time, time_format)
        except ValueError as e:
            return f"無効な時間形式: {e}"

        if wake_datetime <= sleep_datetime:
            wake_datetime += timedelta(days=1)  # 起床時間が前日であれば調整

        duration = wake_datetime - sleep_datetime
        hours, remainder = divmod(duration.total_seconds(), 3600)
        minutes, _ = divmod(remainder, 60)
        return f"{int(hours)}時間{int(minutes)}分"

class UIManager:
    def __init__(self, master):
        self.master = master
        self.create_main_window()

    def create_main_window(self):
        for widget in self.master.winfo_children():
            widget.destroy()

        self.main_frame = ttk.Frame(self.master)
        self.main_frame.pack(fill="both", expand=True)

        # 上部のコントロール
        top_frame = ttk.Frame(self.main_frame)
        top_frame.pack(fill="x", pady=10)

        self.profile_button = ttk.Button(top_frame, text="プロフィール表示/編集")
        self.profile_button.pack(side="left", padx=10)

        self.cbt_info_button = ttk.Button(top_frame, text="睡眠について悩んでおられる方へ")
        self.cbt_info_button.pack(side="right", padx=10)

        # 履歴表示部分
        self.history_frame = ttk.Frame(self.main_frame)
        self.history_frame.pack(fill="both", expand=True, pady=10)

        self.scrollbar = ttk.Scrollbar(self.history_frame)
        self.scrollbar.pack(side="right", fill="y")

        self.canvas = tk.Canvas(self.history_frame)
        self.canvas.pack(side="left", fill="both", expand=True)

        self.scrollbar.config(command=self.canvas.yview)
        self.canvas.config(yscrollcommand=self.scrollbar.set)

        self.history_content = ttk.Frame(self.canvas)
        self.canvas_window = self.canvas.create_window((0, 0), window=self.history_content, anchor="nw")

        self.history_content.bind("<Configure>", self.on_frame_configure)
        self.canvas.bind("<Configure>", self.on_canvas_configure)

        self.history_button = ttk.Button(top_frame, text="睡眠履歴を表示")
        self.history_button.pack(side="left", padx=10)

        # 時間入力部分
        self.create_sleep_input_fields()

        # 情報ラベル
        self.info_label = ttk.Label(self.main_frame, text="")
        self.info_label.pack(pady=10)

    def on_frame_configure(self, event=None):
        self.canvas.configure(scrollregion=self.canvas.bbox("all"))

    def on_canvas_configure(self, event):
        width = event.width
        self.canvas.itemconfig(self.canvas_window, width=width)

    def create_sleep_input_fields(self):
        input_frame = ttk.Frame(self.main_frame)
        input_frame.pack(fill="x", pady=10)

        sleep_frame = ttk.Frame(input_frame)
        sleep_frame.pack(side="left", padx=10)

        ttk.Label(sleep_frame, text="就寝日時:").grid(row=0, column=0, padx=5)
        self.sleep_date_entry = ttk.Entry(sleep_frame, width=10)
        self.sleep_date_entry.grid(row=0, column=1, padx=5)
        self.sleep_time_entry = ttk.Entry(sleep_frame, width=8)
        self.sleep_time_entry.grid(row=0, column=2, padx=5)
        self.sleep_button = ttk.Button(sleep_frame, text="就寝")
        self.sleep_button.grid(row=0, column=3, padx=5)

        wake_frame = ttk.Frame(input_frame)
        wake_frame.pack(side="right", padx=10)

        ttk.Label(wake_frame, text="起床日時:").grid(row=0, column=0, padx=5)
        self.wake_date_entry = ttk.Entry(wake_frame, width=10)
        self.wake_date_entry.grid(row=0, column=1, padx=5)
        self.wake_time_entry = ttk.Entry(wake_frame, width=8)
        self.wake_time_entry.grid(row=0, column=2, padx=5)
        self.wake_button = ttk.Button(wake_frame, text="起床")
        self.wake_button.grid(row=0, column=3, padx=5)

    def show_recent_history(self, recent_records, delete_callback):
        for widget in self.history_content.winfo_children():
            widget.destroy()

        ttk.Label(self.history_content, text="直近7日の履歴データ").pack()

        if not recent_records:
            ttk.Label(self.history_content, text="最近の履歴はありません。").pack()
            return

        for record in recent_records:
            self.create_recent_record_display(self.history_content, record, delete_callback)

        self.on_frame_configure()

    def create_recent_record_display(self, parent_frame, record, delete_callback, show_advice_callback):
        record_frame = ttk.Frame(parent_frame)
        record_frame.pack(fill="x", expand=True, pady=5)

        info_frame = ttk.Frame(record_frame)
        info_frame.pack(side="left", fill="x", expand=True)

        ttk.Label(info_frame, text=f"日付: {record[1]}", wraplength=550).pack(anchor="w")
        ttk.Label(info_frame, text=f"就寝時間: {record[2]}", wraplength=550).pack(anchor="w")
        ttk.Label(info_frame, text=f"起床時間: {record[3]}", wraplength=550).pack(anchor="w")
        ttk.Label(info_frame, text=f"睡眠時間: {record[4]}", wraplength=550).pack(anchor="w")

        button_frame = ttk.Frame(record_frame)
        button_frame.pack(side="right", padx=5)

        ttk.Button(button_frame, text="削除", command=lambda: delete_callback(record[0])).pack(side="top", pady=2)
        ttk.Button(button_frame, text="AI助言を見る", command=lambda: show_advice_callback(record[1])).pack(side="top", pady=2)

        ttk.Separator(parent_frame, orient='horizontal').pack(fill='x', pady=5)
    
    def show_recent_history(self, recent_records, delete_callback, show_advice_callback):
        print("Entering UIManager.show_recent_history method")
        for widget in self.history_content.winfo_children():
            widget.destroy()

        ttk.Label(self.history_content, text="直近7日の履歴データ").pack()

        if not recent_records:
            ttk.Label(self.history_content, text="最近の履歴はありません。").pack()
            return

        for record in recent_records:
            print(f"Creating display for record: {record[1]}")
            self.create_recent_record_display(self.history_content, record, delete_callback, show_advice_callback)

        self.on_frame_configure()
        print("Exiting UIManager.show_recent_history method")
    
    def show_advice_for_record(self, record):
        advice = self.fetch_advice_for_record(record)  # 電話先でのアドバイス取得
        self.show_ai_advice(advice, record[1])  # 日付を使って助言を表示

    def fetch_advice_for_record(self, record):
        record_date = record[1]  # recordのdateフィールド
        advice_history = self.db_manager.execute_query(
            "SELECT advice FROM advice_history WHERE date = ?",
            (record_date,)
        )
        return advice_history[0][0] if advice_history else None

    def get_recent_advice(self):
        # このメソッドはAI助言を取得するためのコールバックに接続されます
        if hasattr(self, 'recent_records'):
            for record in self.recent_records:
                # 各記録に基づいてAIの助言を生成する
                self.show_ai_advice(record[11], record[1])  # record[11]はadvice_history_idを指す

    def show_cbt_info(self, content, save_callback):
        cbt_window = tk.Toplevel(self.master)
        cbt_window.title("CBT情報")
        cbt_window.geometry("400x400")

        ttk.Label(cbt_window, text="CBTに関する情報:").pack(pady=5)
        cbt_text = scrolledtext.ScrolledText(cbt_window, height=15, width=50)
        cbt_text.pack(pady=5)
        cbt_text.insert("1.0", content)
        cbt_text.config(state=tk.NORMAL)

        def save_content():
            new_content = cbt_text.get("1.0", tk.END).strip()
            save_callback(new_content)
            cbt_window.destroy()

        ttk.Button(cbt_window, text="保存", command=save_content).pack(pady=20)
        pass

    def show_profile_window(self, profile, save_callback):
        profile_window = tk.Toplevel(self.master)
        profile_window.title("ユーザープロフィール")
        profile_window.geometry("400x400")

        ttk.Label(profile_window, text="ニックネーム:").pack(pady=5)
        nickname_var = tk.StringVar(value=profile['nickname'])
        nickname_entry = ttk.Entry(profile_window, textvariable=nickname_var)
        nickname_entry.pack(pady=5)

        ttk.Label(profile_window, text="睡眠薬の使用:").pack(pady=5)
        sleep_med_var = tk.StringVar(value=profile['sleep_medication'])
        ttk.Combobox(profile_window, textvariable=sleep_med_var, values=['使用していない', '使用している']).pack(pady=5)

        ttk.Label(profile_window, text="睡眠薬の減薬意思:").pack(pady=5)
        med_reduction_var = tk.StringVar(value=profile['medication_reduction'])
        ttk.Combobox(profile_window, textvariable=med_reduction_var, values=['該当なし', '減らしたい', '現状維持']).pack(pady=5)

        ttk.Label(profile_window, text="アドバイスの強度:").pack(pady=5)
        advice_intensity_var = tk.StringVar(value=profile['advice_intensity'])
        ttk.Combobox(profile_window, textvariable=advice_intensity_var, values=['ライト', 'ミディアム', 'ハード']).pack(pady=5)

        def save_profile():
            updated_profile = {
                'id': profile['id'],
                'nickname': nickname_var.get(),
                'sleep_medication': sleep_med_var.get(),
                'medication_reduction': med_reduction_var.get(),
                'advice_intensity': advice_intensity_var.get()
            }
            save_callback(updated_profile)
            profile_window.destroy()

        ttk.Button(profile_window, text="保存", command=save_profile).pack(pady=20)
        pass

    def create_sleep_input_fields(self):
        sleep_frame = ttk.Frame(self.master)
        sleep_frame.pack(fill="x", padx=10, pady=5)

        ttk.Label(sleep_frame, text="就寝日時:").grid(row=0, column=0, padx=5)
        self.sleep_date_entry = ttk.Entry(sleep_frame, width=10)
        self.sleep_date_entry.grid(row=0, column=1, padx=5)
        self.sleep_time_entry = ttk.Entry(sleep_frame, width=8)
        self.sleep_time_entry.grid(row=0, column=2, padx=5)
        self.sleep_button = ttk.Button(sleep_frame, text="寝る準備が整った時に押して下さい")
        self.sleep_button.grid(row=0, column=3, padx=5)

        wake_frame = ttk.Frame(self.master)
        wake_frame.pack(fill="x", padx=10, pady=5)

        ttk.Label(wake_frame, text="起床日時:").grid(row=0, column=0, padx=5)
        self.wake_date_entry = ttk.Entry(wake_frame, width=10)
        self.wake_date_entry.grid(row=0, column=1, padx=5)
        self.wake_time_entry = ttk.Entry(wake_frame, width=8)
        self.wake_time_entry.grid(row=0, column=2, padx=5)
        self.wake_button = ttk.Button(wake_frame, text="起きた時に押して睡眠時間と感想を教えて下さい")
        self.wake_button.grid(row=0, column=3, padx=5)

    def show_message(self, message, type="info"):
        if type == "info":
            messagebox.showinfo("情報", message)
        elif type == "warning":
            messagebox.showwarning("警告", message)
        elif type == "error":
            messagebox.showerror("エラー", message)
        pass

    def show_sleep_preparation_window(self, save_callback):
        prep_window = tk.Toplevel(self.master)
        prep_window.title("今日一日の振り返り")
        prep_window.geometry("600x400")

        ttk.Label(prep_window, text="今日一日の振り返り", font=("", 12, "bold")).pack(pady=10)

        prep_text = scrolledtext.ScrolledText(prep_window, height=10, width=50)
        prep_text.pack(pady=5)
        prep_text.insert("1.0", "例えば、今日は体調が良かった、体調が悪かった、日中眠かった、寝る前の習慣として何かをした、何か実践した、等、自由記入して下さい。")

        ttk.Label(prep_window, text="※慣れてきたら、より詳細な内容を書いておくと、AIからの返答の質が高まる可能性があります。", wraplength=500).pack(pady=5)

        def save_prep():
            prep_text_content = prep_text.get("1.0", tk.END).strip()
            save_callback(prep_text_content)
            prep_window.destroy()

        ttk.Button(prep_window, text="記録する", command=save_prep).pack(pady=10)
        pass

    def show_feedback_window(self, save_callback):
        feedback_window = tk.Toplevel(self.master)
        feedback_window.title("睡眠の振り返り")
        feedback_window.geometry("600x800")

        canvas = tk.Canvas(feedback_window)
        scrollbar = ttk.Scrollbar(feedback_window, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)

        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )

        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        ttk.Label(scrollable_frame, text="今日の睡眠の満足度を感覚で良いので選んで下さい。", font=("", 12, "bold")).pack(pady=10)

        scales = {}
        for label in ["睡眠の満足度", "快眠度合", "睡眠への不満度", "睡眠への不安、焦り、ストレス"]:
            ttk.Label(scrollable_frame, text=label).pack()
            scale = ttk.Scale(scrollable_frame, from_=0, to=100, orient=tk.HORIZONTAL, length=300)
            scale.pack()
            scales[label] = scale

        ttk.Label(scrollable_frame, text="これらを振り返って思ったこと、思い足りそうな点、その他気になることを入力して下さい", font=("", 12, "bold")).pack(pady=10)
        reflection_text = scrolledtext.ScrolledText(scrollable_frame, height=10, width=50)
        reflection_text.pack(pady=5)
        reflection_text.insert("1.0", "例えば、よく眠れて快眠だった、睡眠時間が短く不満だった、睡眠が浅くストレスを感じた、怖い夢悪夢をみた、等、自由記入して下さい。")

        ttk.Label(scrollable_frame, text="※慣れてきたら、より詳細な内容を書いておくと、AIからの返答の質が高まる可能性があります。", wraplength=500).pack(pady=5)

        def save_feedback():
            feedback_data = {
                "睡眠の満足度": scales["睡眠の満足度"].get(),
                "快眠度合": scales["快眠度合"].get(),
                "睡眠への不満度": scales["睡眠への不満度"].get(),
                "睡眠への不安、焦り、ストレス": scales["睡眠への不安、焦り、ストレス"].get(),
                "reflection": reflection_text.get("1.0", tk.END).strip()
            }
            save_callback(feedback_data)
            feedback_window.destroy()

        ttk.Button(scrollable_frame, text="記録する", command=save_feedback).pack(pady=10)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        pass

    def show_history_window(self, calendar_callback, week_advice_callback, month_advice_callback):
        history_window = tk.Toplevel(self.master)
        history_window.title("睡眠履歴とAI助言")
        history_window.geometry("800x700")

        cal = Calendar(history_window, selectmode='day', date_pattern='y-mm-dd')
        cal.pack(pady=20)
        cal.bind("<<CalendarSelected>>", calendar_callback)

        ttk.Button(history_window, text="直近1週間のAI助言を受ける", 
                   command=week_advice_callback).pack(pady=10)
        ttk.Button(history_window, text="直近1ヶ月のAI助言を受ける", 
                   command=month_advice_callback).pack(pady=10)

        info_frame = ttk.Frame(history_window)
        info_frame.pack(fill="both", expand=True, padx=20, pady=20)

        return cal, info_frame

    def show_ai_advice(self, advice, date):
        advice_window = tk.Toplevel(self.master)
        advice_window.title("AIからのアドバイス")
        advice_window.geometry("600x400")

        text_widget = scrolledtext.ScrolledText(advice_window, wrap=tk.WORD)
        text_widget.pack(expand=True, fill="both", padx=10, pady=10)
        
        text_widget.insert(tk.END, f"日付: {date}\n\n")
        text_widget.insert(tk.END, advice if advice else "この日のアドバイスはありません。")
        
        text_widget.config(state=tk.DISABLED)
        ttk.Button(advice_window, text="OK", command=advice_window.destroy).pack(pady=10)
        pass

    def create_record_display(self, parent_frame, record):
        for widget in parent_frame.winfo_children():
            widget.destroy()

        canvas = tk.Canvas(parent_frame)
        scrollbar = ttk.Scrollbar(parent_frame, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)

        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )

        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        ttk.Label(scrollable_frame, text=f"日付: {record[1]}", wraplength=550).pack(anchor="w")
        ttk.Label(scrollable_frame, text=f"就寝時間: {record[2]}", wraplength=550).pack(anchor="w")
        ttk.Label(scrollable_frame, text=f"起床時間: {record[3]}", wraplength=550).pack(anchor="w")
        ttk.Label(scrollable_frame, text=f"睡眠時間: {record[4]}", wraplength=550).pack(anchor="w")
        ttk.Label(scrollable_frame, text=f"睡眠満足度: {record[5]}", wraplength=550).pack(anchor="w")
        ttk.Label(scrollable_frame, text=f"快眠度合: {record[6]}", wraplength=550).pack(anchor="w")
        ttk.Label(scrollable_frame, text=f"睡眠への不満度: {record[7]}", wraplength=550).pack(anchor="w")
        ttk.Label(scrollable_frame, text=f"睡眠への不安、焦り、ストレス: {record[8]}", wraplength=550).pack(anchor="w")
        ttk.Label(scrollable_frame, text=f"寝る前の振り返り: {record[9]}", wraplength=550).pack(anchor="w")
        ttk.Label(scrollable_frame, text=f"起床後の振り返り: {record[10]}", wraplength=550).pack(anchor="w")
        
        if record[11]:  # AI助言がある場合（advice_history_idが存在する場合）
            ttk.Label(scrollable_frame, text="AIからの助言:", wraplength=550, font=("", 10, "bold")).pack(anchor="w")
            ttk.Button(scrollable_frame, text="アドバイスを表示", 
                       command=lambda: self.show_ai_advice(record[11], record[1])).pack(anchor="w", pady=5)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

    def refresh_calendar(self, cal, all_dates):
        cal.calevent_remove('all')
        for date_str in all_dates:
            date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
            cal.calevent_create(date=date_obj, text="AI助言あり", tags="advice")
        cal.tag_config('advice', background='lightblue')

from openai import OpenAI
class AIAdviceManager:
    def __init__(self, db_manager, api_key):
        self.db_manager = db_manager
        self.client = OpenAI(api_key=api_key)

    def generate_advice(self, sleep_data, user_profile):
        # AIに送信するプロンプトを作成
        prompt = self._create_prompt(sleep_data, user_profile)

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": str(sleep_data)}
                ],
                max_tokens=1000
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"AIの応答生成中にエラーが発生しました: {str(e)}")
            return None

    def save_advice(self, advice, date):
        query = "INSERT INTO advice_history (advice, date) VALUES (?, ?)"
        self.db_manager.execute_query(query, (advice, date))

    def get_advice_history(self, limit=5):
        query = "SELECT advice, date FROM advice_history ORDER BY date DESC LIMIT ?"
        return self.db_manager.execute_query(query, (limit,))

    def _create_prompt(self, sleep_data, user_profile):
        med_instruction = self._get_med_instruction(user_profile)
        intensity_instruction = self._get_intensity_instruction(user_profile)

        return f"""
        あなたは睡眠の最新研究科学者です。ユーザーの睡眠データを分析し、個別化された助言を提供してください。
        最新の研究に基づき、睡眠制限法、刺激統制法、認知再構成法、マインドフルネスが睡眠改善に効果がある可能性があることを述べ、具体的な手法を提案して下さい。
        ただし、これらは一般的な情報であり、個人差があることを強調し、効果が薄いとされる睡眠衛生指導、リラクゼーション法（特に筋弛緩法）については逆効果の可能性が研究結果が出ているので、くれぐれも慎重に扱ってください。

        {med_instruction}
        {intensity_instruction}

        1. 指定された起床日の記録に特に注目し、それに対して具体的に応答してください。
        2. ユーザーの感情や経験に共感を示し、肯定的なフィードバックを提供しつつ、認知再構成法の一般論を提案、具体的な手法を示して下さい。
        3. 指定された起床日の記録と過去のパターンを比較し、睡眠制限法の一般論を提案、具体的な手法を示し、改善点や変化を指摘してください。
        4. ユーザーが実践しているルーティンや習慣を肯定的に評価し、刺激統制法の一般論を提案、具体的な手法を示し、その継続を奨励してください。
        5. 睡眠データの傾向に基づいて、具体的な改善点や新たな目標を提案してください。また、マインドフルネス（一般的なリラクゼーションとは区別すること、逆効果が示唆されているため）の一般論を提案、具体的な手法を示して下さい。
        ※2、3、4、5についての認知行動療法における提案は、必ず1日に1つの手法の提案に留めて、それをわかりやすく解説して提案してください。一日の助言に複数の手法を提案をしてユーザーを混乱させないように努めて下さい。
        6. 医療行為・診断・治癒行為を避け、あくまで可能性を示し、常に認知行動療法の支援に努めて下さい。
        7. ユーザーのプロフィール情報（ニックネーム、睡眠薬使用状況など）を考慮し、個別化された助言を提供してください。
        8. 過去や直近の助言と重複しないよう、新しい視点や異なるアプローチを提供してください。
        9. 睡眠薬に関するコメントは、上記の指示に厳密に従ってください。特に指示がない限り、睡眠薬について言及しないでください。薬物の情報は聞かれても提供しないでください。
        10.頑張りましたね、頑張りましょう、頑張ってください、という表現は避けること。不眠症の方は頑張っても寝られない、もしくは不安症や鬱の方には逆効果が考えられるため。
        11. ネガティブな内容には専門家相談を勧めてください。

        以下の要素を含めて、自然な文章として回答を構成してください：
        - ユーザーの感情や経験に共感を示す(共感を示します、と述べるのではなく自然な流れで共感を示す)
        - 最近の傾向との比較
        - 肯定的な評価とアドバイス
        - 具体的な改善提案や目標設定

        ただし、これらの要素を明示的な見出しとして使用せず、流れるような自然な文章として提供してください。
        個人情報には触れず、500文字以内で回答してください。
        """

    def _get_med_instruction(self, user_profile):
        sleep_med_status = user_profile['sleep_medication']
        med_reduction_intent = user_profile['medication_reduction']

        if sleep_med_status == '使用している':
            if med_reduction_intent == '減らしたい':
                return "ユーザーは睡眠薬を使用しており、減薬を希望しています。医師との相談を必須とし、減薬の可能性について慎重に言及してください。ただし、この話題は7日に1回程度の頻度でのみ触れ、それ以外の日は睡眠薬について言及しないでください。"
            elif med_reduction_intent == '現状維持':
                return "ユーザーは睡眠薬を使用しており、現状維持を希望しています。睡眠薬について言及せず、非薬物的なアプローチに焦点を当ててアドバイスしてください。"
        return "ユーザーは睡眠薬を使用していません。睡眠薬について言及せず、非薬物的なアプローチに焦点を当ててアドバイスしてください。"

    def _get_intensity_instruction(self, user_profile):
        advice_intensity = user_profile['advice_intensity']

        if advice_intensity == 'ライト':
            return "基本的な睡眠衛生と生活リズムに関する一般的なアドバイスを中心に提供してください。詳細な技法には踏み込まないでください。"
        elif advice_intensity == 'ミディアム':
            return "睡眠制限法と刺激統制法の基本的な導入方法を提案し、簡単な認知再構成の技法を紹介してください。睡眠パターンの分析も行ってください。"
        elif advice_intensity == 'ハード':
            return "高度な認知行動療法の技法とマインドフルネスの実践方法を提案し、個別化された睡眠改善計画を提供してください。必要に応じて専門家への相談も勧めてください。"
        else:
            return "中程度の強度でアドバイスを提供してください。"

    def get_advice_for_date(self, date):
        query = "SELECT advice FROM advice_history WHERE date = ?"
        formatted_date = date if isinstance(date, str) else date.strftime("%Y-%m-%d")
        result = self.db_manager.execute_query(query, (formatted_date,))
        advice = result[0][0] if result else None
        print(f"Debug: get_advice_for_date called for {formatted_date}, result: {advice}")
        return advice
    
import tkinter as tk
from datetime import datetime, timedelta

# SleepTherapyApp クラス内の関連部分の修正
class SleepTherapyApp:
    def __init__(self, master):
        self.master = master
        self.db_manager = DatabaseManager()
        self.ai_advice_manager = AIAdviceManager(self.db_manager, "")
        self.user_profile_manager = UserProfileManager(self.db_manager)
        self.sleep_record_manager = SleepRecordManager(self.db_manager, self.ai_advice_manager)
        self.ui_manager = UIManager(master)


        self.db_manager.create_tables()
        threading.Thread(target=self.load_user_profile, daemon=True).start()
        self.ui_manager.create_main_window()
        self.bind_events()

        self.show_recent_history()

    def bind_events(self):
        self.ui_manager.profile_button.config(command=self.show_user_profile)
        self.ui_manager.cbt_info_button.config(command=self.show_cbt_info)
        self.ui_manager.sleep_button.config(command=self.record_sleep)  # ここを修正
        self.ui_manager.wake_button.config(command=self.record_wake)
        self.ui_manager.history_button.config(command=self.show_history)

    def load_user_profile(self):
        self.current_user = self.user_profile_manager.get_user_profile(1)
        if not self.current_user:
            self.current_user = self.user_profile_manager.create_new_profile(1)
        self.master.after(0, self.show_recent_history)
    
    def show_recent_history(self):
        print("Entering show_recent_history method")
        recent_records = self.sleep_record_manager.get_recent_records(days=7)
        print(f"Retrieved {len(recent_records)} recent records")
        self.ui_manager.show_recent_history(recent_records, self.delete_record, self.show_ai_advice_for_record)
        print("Exiting show_recent_history method")

    def show_ai_advice_for_record(self, date):
        print(f"Showing AI advice for date: {date}")
        advice = self.ai_advice_manager.get_advice_for_date(date)  # この行を修正
        if advice:
            self.ui_manager.show_ai_advice(advice, date)
        else:
            self.ui_manager.show_message(f"{date}のAI助言はありません。", "info")

    def save_user_profile(self, updated_profile):
        self.user_profile_manager.save_user_profile(updated_profile)
        self.current_user = updated_profile
        self.ui_manager.show_message("プロフィールが更新されました。")
    
    def show_user_profile(self):
        self.ui_manager.show_profile_window(self.current_user, self.save_user_profile)

    def save_user_profile(self, updated_profile):
        self.user_profile_manager.save_user_profile(updated_profile)
        self.current_user = updated_profile
        self.ui_manager.show_message("プロフィールが更新されました。")

    def show_cbt_info(self):
        cbt_content = self.db_manager.execute_query("SELECT content FROM cbt_info WHERE id = 1")
        
        if not cbt_content:
            default_content = "不眠症の認知行動療法に関する情報をここに入力してください。"
            self.db_manager.execute_query("INSERT INTO cbt_info (id, content) VALUES (1, ?)", (default_content,))
            cbt_content = default_content
        else:
            cbt_content = cbt_content[0][0]

        def save_cbt_content(new_content):
            self.db_manager.execute_query("UPDATE cbt_info SET content = ? WHERE id = 1", (new_content,))

        self.ui_manager.show_cbt_info(cbt_content, save_cbt_content)

    def show_sleep_preparation(self):
        self.ui_manager.show_sleep_preparation_window(self.save_sleep_preparation)

    def save_sleep_preparation(self, preparation_text):
        if not hasattr(self, 'sleep_time'):
            self.ui_manager.show_message("就寝時間が記録されていません。", "error")
            return
        self.sleep_preparation_data = {
            "preparation_text": preparation_text,
            "sleep_time": self.sleep_time
        }
        self.ui_manager.show_message("就寝時間と準備情報を記録しました。")

    def record_sleep(self):
        date_str = self.ui_manager.sleep_date_entry.get()
        time_str = self.ui_manager.sleep_time_entry.get()
        
        print(f"Debug: date_str = {date_str}, time_str = {time_str}")  # デバッグ用
        
        if not date_str or not time_str:
            self.ui_manager.show_message("日付と時刻を入力してください。", "error")
            return
        
        try:
            sleep_datetime = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
            self.sleep_time = sleep_datetime.strftime("%Y-%m-%d %H:%M:%S")
            print(f"Debug: sleep_time set to {self.sleep_time}")  # デバッグ用
            self.ui_manager.show_message(f"就寝時間を記録しました: {self.sleep_time}")
            self.ui_manager.show_sleep_preparation_window(self.save_sleep_preparation)
        except ValueError as e:
            print(f"Debug: ValueError - {e}")  # デバッグ用
            self.ui_manager.show_message("無効な日付または時間形式です。YYYY-MM-DD HH:MM の形式で入力してください。", "error")

    def record_wake(self):
        if not hasattr(self, 'sleep_time'):
            self.ui_manager.show_message("就寝時間が記録されていません。先に就寝時間を記録してください。", "warning")
            return

        date_str = self.ui_manager.wake_date_entry.get()
        time_str = self.ui_manager.wake_time_entry.get()
        
        try:
            wake_datetime = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
            self.wake_time = wake_datetime.strftime("%Y-%m-%d %H:%M:%S")
            self.ui_manager.show_message(f"起床時間を記録しました: {self.wake_time}")
            self.ui_manager.show_feedback_window(self.save_sleep_record)
        except ValueError:
            self.ui_manager.show_message("無効な日付または時間形式です。YYYY-MM-DD HH:MM の形式で入力してください。", "error")

    def save_sleep_record(self, feedback_data):
        sleep_duration = self.sleep_record_manager.calculate_sleep_duration(self.sleep_time, self.wake_time)
        record = {
            'date': self.wake_time.split()[0],
            'sleep_time': self.sleep_time,
            'wake_time': self.wake_time,
            'sleep_duration': sleep_duration,
            'sleep_satisfaction': feedback_data['睡眠の満足度'],
            'sleep_quality': feedback_data['快眠度合'],
            'sleep_dissatisfaction': feedback_data['睡眠への不満度'],
            'sleep_anxiety': feedback_data['睡眠への不安、焦り、ストレス'],
            'sleep_preparation': self.sleep_preparation_data.get('preparation_text', ''),
            'sleep_reflection': feedback_data['reflection']
        }
        self.sleep_record_manager.save_sleep_record(record)
        self.generate_ai_advice(record)

    def generate_ai_advice(self, sleep_record):
        advice = self.ai_advice_manager.generate_advice(sleep_record, self.current_user)
        if advice:
            self.ai_advice_manager.save_advice(advice, sleep_record['date'])
            self.ui_manager.show_ai_advice(advice, sleep_record['date'])
            self.refresh_calendar()  # カレンダーを更新
        else:
            self.ui_manager.show_message("AI助言の生成に失敗しました。", "error")

    def show_history(self):
        cal, info_frame = self.ui_manager.show_history_window(
            self.on_date_selected,
            lambda: self.get_period_advice("week"),
            lambda: self.get_period_advice("month")
        )
        self.history_calendar = cal
        self.history_info_frame = info_frame
        
        # カレンダーの更新
        self.refresh_calendar()

    def refresh_calendar(self):
        all_dates = self.db_manager.get_all_advice_dates()
        self.ui_manager.refresh_calendar(self.history_calendar, all_dates)

    def on_date_selected(self, event):
        selected_date = self.history_calendar.get_date()
        formatted_date = selected_date if isinstance(selected_date, str) else selected_date.strftime("%Y-%m-%d")
        records = self.sleep_record_manager.get_sleep_records(formatted_date, formatted_date)

        # 履歴を表示するセクションをクリア
        for widget in self.history_info_frame.winfo_children():
            widget.destroy()

        if records:
            self.ui_manager.create_record_display(self.history_info_frame, records[0])

            # AIの助言を直接取得
            advice = self.ai_advice_manager.get_advice_for_date(formatted_date)
            if advice:
                self.ui_manager.show_ai_advice(advice, formatted_date)
            else:
                ttk.Label(self.history_info_frame, text="この日の助言はありません。").pack()
        else:
            ttk.Label(self.history_info_frame, text="この日の記録はありません。").pack()

        print(f"Debug: Selected date: {formatted_date}, Advice: {advice if advice else 'None'}")

    def get_period_advice(self, period):
        end_date = datetime.now().date()
        if period == "week":
            start_date = end_date - timedelta(days=7)
        else:  # month
            start_date = end_date - timedelta(days=30)

        records = self.sleep_record_manager.get_sleep_records(start_date, end_date)
        if not records:
            self.ui_manager.show_message(f"選択された期間（{period}）のデータがありません。")
            return

        advice = self.ai_advice_manager.generate_advice(records, self.current_user)
        if advice:
            self.ui_manager.show_ai_advice(advice, f"{start_date} から {end_date}")
        else:
            self.ui_manager.show_message("AI助言の生成に失敗しました。", "error")
        pass
 
    def request_ai_advice(self, record):
        advice = self.ai_advice_manager.generate_advice(record, self.current_user)
        if advice:
            self.ui_manager.show_ai_advice(advice, record['date'])
        else:
            self.ui_manager.show_message("AI助言の生成に失敗しました。", "error")

    def delete_record(self, record_id):
        self.sleep_record_manager.delete_record(record_id)
        self.show_recent_history()
        self.ui_manager.show_message("記録が削除されました。")

if __name__ == "__main__":
    root = tk.Tk()
    app = SleepTherapyApp(root)
    root.mainloop()
