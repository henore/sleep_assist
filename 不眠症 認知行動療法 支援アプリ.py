
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import sqlite3
from datetime import datetime, timedelta
from collections import defaultdict
import json
from openai import OpenAI
import os

class SleepTherapyApp:
    def __init__(self, master):
        self.master = master
        self.master.title("不眠症認知行動療法支援アプリ")
        self.master.geometry("800x700")  # ウィンドウサイズを大きくしました

        API_KEY = ""
        self.client = OpenAI(api_key=API_KEY)

        self.sleep_time = None
        self.wake_time = None
        self.nap_time = None

        self.create_widgets()

        # プレースホルダーテキストの設定
        self.sleep_date_entry.insert(0, "YYYY-MM-DD")
        self.sleep_time_entry.insert(0, "HH:MM")
        self.wake_date_entry.insert(0, "YYYY-MM-DD")
        self.wake_time_entry.insert(0, "HH:MM")

        # フォーカスイン時にプレースホルダーテキストを消去
        self.sleep_date_entry.bind("<FocusIn>", lambda e: self.clear_placeholder(e, "YYYY-MM-DD"))
        self.sleep_time_entry.bind("<FocusIn>", lambda e: self.clear_placeholder(e, "HH:MM"))
        self.wake_date_entry.bind("<FocusIn>", lambda e: self.clear_placeholder(e, "YYYY-MM-DD"))
        self.wake_time_entry.bind("<FocusIn>", lambda e: self.clear_placeholder(e, "HH:MM"))

        # フォーカスアウト時に空ならプレースホルダーテキストを表示
        self.sleep_date_entry.bind("<FocusOut>", lambda e: self.restore_placeholder(e, "YYYY-MM-DD"))
        self.sleep_time_entry.bind("<FocusOut>", lambda e: self.restore_placeholder(e, "HH:MM"))
        self.wake_date_entry.bind("<FocusOut>", lambda e: self.restore_placeholder(e, "YYYY-MM-DD"))
        self.wake_time_entry.bind("<FocusOut>", lambda e: self.restore_placeholder(e, "HH:MM"))

        self.create_database()
        self.show_recent_history()

    def create_widgets(self):
        ttk.Button(self.master, text="不眠症の認知行動療法とは", command=self.show_cbt_info).pack(anchor="nw", padx=10, pady=10)

        # 睡眠時間入力フレーム
        sleep_frame = ttk.Frame(self.master)
        sleep_frame.pack(fill="x", padx=10, pady=5)

        ttk.Label(sleep_frame, text="就寝日時:").grid(row=0, column=0, padx=5)
        self.sleep_date_entry = ttk.Entry(sleep_frame, width=10)
        self.sleep_date_entry.grid(row=0, column=1, padx=5)
        self.sleep_time_entry = ttk.Entry(sleep_frame, width=8)
        self.sleep_time_entry.grid(row=0, column=2, padx=5)
        sleep_button = ttk.Button(sleep_frame, text="寝る準備が整った時に押して下さい", command=self.record_sleep)
        sleep_button.grid(row=0, column=3, padx=5)

        # 起床時間入力フレーム
        wake_frame = ttk.Frame(self.master)
        wake_frame.pack(fill="x", padx=10, pady=5)

        ttk.Label(wake_frame, text="起床日時:").grid(row=0, column=0, padx=5)
        self.wake_date_entry = ttk.Entry(wake_frame, width=10)
        self.wake_date_entry.grid(row=0, column=1, padx=5)
        self.wake_time_entry = ttk.Entry(wake_frame, width=8)
        self.wake_time_entry.grid(row=0, column=2, padx=5)
        wake_button = ttk.Button(wake_frame, text="起きた時にボタンを押して睡眠時間や実践したこと、感想を教えて下さい", command=self.record_wake)
        wake_button.grid(row=0, column=3, padx=5)

    #    ttk.Button(self.master, text="昼寝をした", command=self.record_nap).pack(pady=10)
        ttk.Button(self.master, text="睡眠履歴とAIの助言を振り返る", command=self.show_history).pack(pady=10)

        self.info_label = ttk.Label(self.master, text="")
        self.info_label.pack(pady=10)

        self.history_frame = ttk.Frame(self.master)
        self.history_frame.pack(fill="both", expand=True, pady=10)

       
    def create_database(self):
        conn = sqlite3.connect('sleep_data.db')
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS sleep_records
                    (date TEXT, sleep_time TEXT, wake_time TEXT, nap_time TEXT, 
                    good_points TEXT, good_points_free TEXT, 
                    bad_points TEXT, bad_points_free TEXT, therapy_notes TEXT, ai_advice TEXT,
                    sleep_duration TEXT, practiced_points TEXT)''')
        c.execute('''CREATE TABLE IF NOT EXISTS cbt_info
                    (id INTEGER PRIMARY KEY, content TEXT)''')
        conn.commit()
        conn.close()

# クラス内のメソッドとして定義する場合
    def generate_ai_response(self, user_input):
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "あなたは睡眠習慣の改善の情報提供サポーターです。全ての助言は医療行為の代替としての行為は行わなわず、一般的な情報提供を行うこと。#基本的にはチェック内容全体を分析して、サポート型の回答をして下さい。基本は助言や提案のみとし、あなたから、例えば気になる点や思ったことはありませんか？と問いかけたり、質問は絶対にしないこと。こちらから対話形式で返答が返せないからだ。 #あなたはあくまで不眠症改善の情報提供をする役割で、応援も大事だが、まず助言を最優先すること。できてないことや不合理な点があったとしても、批判的な回答はなるべく控えること。例えば睡眠時間が10時間で長すぎたとしても、表現はマイルドな内容にすること。#睡眠制限は睡眠時間の調整に置き換え、刺激制御は就寝前の習慣づくりに置き換えて、認知の変化は睡眠に対する意識に置き換え、睡眠習慣の改善が見られる場合は褒めて継続できるように促すこと。具体的例としては睡眠制限は睡眠時間の調整ができている時は今の睡眠時間が適切かどうか観察してみて下さい、等。就寝前の習慣づくりができている場合は、それは良い習慣です、続けていけば効果が期待できるかも知れません、等。睡眠に対する意識が変わっている場合は、一つずつ時間をかけて意識を変えていくことで、効果が得られるかも知れません、等。#睡眠時間の調整、睡眠習慣の改善を実践していない、及び睡眠に対する意識の歪みや考え方を是正した方が良い場合は、それらを提案すること。睡眠時間の計算結果が短すぎる、長すぎる場合は、睡眠時間の調整や睡眠習慣の改善の提案をしてみて下さい。具体例としては、寝る時間と起きる時間が把握できたら、そのペースを引き続き継続して、変化があるか観察してみましょう、や、脳に寝る準備をするシグナルを与えると眠気が来る可能性があるため、寝る前に何かの習慣づけることを試してみてはどうでしょうか、変化があるかも知れません、等。睡眠に対する意識がに歪みあった場合の具体例としては、何か決めつけていることや悲観的、不合理な点は対して、例えばこのように考え方が変われば睡眠に変化があるかも知れません、等。#睡眠薬をネガティブに伝えないこと。減らせる自信がついてきたという項目や、その旨の感想があれば今の量を減らせるようにサポートしてあげる方向性で良い。しかしその場合を除き、こちらから睡眠薬の話は絶対しないこと。また、睡眠薬の具体的な名称や用量、増減については、もしあなたが質問を受けてもあなたの判断で回答しないことを大前提とし、特に増減に関してはAIの助言や個人での判断は絶対させず、医師や専門家への相談を必ず強く勧めること。あなたから減薬しませんか？減薬にチャレンジしましょう、減薬を勧めます、という提案は絶対にしないこと。#不安、焦り、ストレス、過度な期待や、気になった点にネガティブな内容がある場合は、必ず励ましてサポートしてあげて下さい。#ネガティブな項目が複数見られる場合は、医師に相談することも勧めてみて下さい。#ネガティブなチェック項目が多い、気になる点の内容を鑑みて症状に深刻さが見られる場合は、必ず医師や専門家に相談するように強く提案すること。 #鬱傾向の人も考えられるので、励ましを行い、頑張ろう、頑張って、頑張って続けましょう。という提案や文章は絶対使わないこと。例えば、何か一つでも実践して継続していけるようになれば、変化があるかも知れません、サポート致します。等とする。#ユーザーの実名、かかっている医療機関名には触れないこと。個人情報の入力は基本的に避けてもらうこと。#改行は無しで350文字以内に必ずまとめて、文章が途切れないように注意して。 "},
                    {"role": "user", "content": user_input}
                ],
                max_tokens=4096
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"AIの応答生成中にエラーが発生しました: {str(e)}"

        
    def show_cbt_info(self):
        cbt_window = tk.Toplevel(self.master)
        cbt_window.title("不眠症の認知行動療法とは")
        cbt_window.geometry("500x600")

        conn = sqlite3.connect('sleep_data.db')
        c = conn.cursor()
        c.execute('SELECT content FROM cbt_info WHERE id = 1')
        result = c.fetchone()
        if result:
            content = result[0]
        else:
            content = "不眠症の認知行動療法に関する情報をここに入力してください。"
            c.execute('INSERT INTO cbt_info (id, content) VALUES (1, ?)', (content,))
            conn.commit()
        conn.close()

        text_area = scrolledtext.ScrolledText(cbt_window, wrap=tk.WORD)
        text_area.pack(expand=True, fill='both', padx=10, pady=10)
        text_area.insert(tk.END, content)

        def save_content():
            new_content = text_area.get("1.0", tk.END).strip()
            conn = sqlite3.connect('sleep_data.db')
            c = conn.cursor()
            c.execute('UPDATE cbt_info SET content = ? WHERE id = 1', (new_content,))
            conn.commit()
            conn.close()
            messagebox.showinfo("保存完了", "情報が更新されました。")

        ttk.Button(cbt_window, text="保存", command=save_content).pack(pady=10)
    
    
    def record_sleep(self):
        self.record_time(self.sleep_date_entry, self.sleep_time_entry, "sleep")
    
    def record_wake(self):
        self.record_time(self.wake_date_entry, self.wake_time_entry, "wake")
        self.show_feedback()

    def record_time(self, date_entry, time_entry, action):
        date_str = date_entry.get()
        time_str = time_entry.get()
        
        if date_str == "YYYY-MM-DD" or time_str == "HH:MM":
            # 現在時刻を使用
            now = datetime.now()
            date_str = now.strftime("%Y-%m-%d")
            time_str = now.strftime("%H:%M")
            date_entry.delete(0, tk.END)
            time_entry.delete(0, tk.END)
            date_entry.insert(0, date_str)
            time_entry.insert(0, time_str)
        
        try:
            recorded_time = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
            if action == "sleep":
                self.sleep_time = recorded_time
            else:
                self.wake_time = recorded_time
            self.update_info()
            messagebox.showinfo("記録完了", f"{'就寝' if action == 'sleep' else '起床'}時間を記録しました: {recorded_time.strftime('%Y-%m-%d %H:%M')}")
        except ValueError:
            messagebox.showerror("エラー", "無効な日付または時間形式です。YYYY-MM-DD HH:MM の形式で入力してください。")

    def show_feedback(self):
        if not self.sleep_time:
            messagebox.showwarning("警告", "就寝時間が記録されていません。就寝時間を先に記録してください。")
            return

        self.feedback_window = tk.Toplevel(self.master)
        self.feedback_window.title("起床時の感想")
        self.feedback_window.geometry("600x800")

        notebook = ttk.Notebook(self.feedback_window)
        notebook.pack(fill="both", expand=True)

        # 認知行動療法で実践したことのタブ
        practiced_frame = ttk.Frame(notebook)
        notebook.add(practiced_frame, text="認知行動療法で実践したこと")
        self.create_practiced_tab(practiced_frame)

        # 改善が見られた点のタブ
        improved_frame = ttk.Frame(notebook)
        notebook.add(improved_frame, text="改善が見られた点")
        self.create_improved_tab(improved_frame)

        # 気になった点のカテゴリ
        self.bad_points_categories = {
            "不安感": [
                "睡眠薬の効果を感じられず、不安だったり、寝起きを繰り返した",
                "なぜ眠れないのか色々考えすぎて不安だった",
                "今日も寝付きが悪いのではないかと不安だった",
                "全く眠れないかもしれないと不安だった",
                "何時に寝られるか気になって不快だった",
                "途中で起きたり、早く起きたりしないか不安だった",
                "寝坊やそれによるトラブルが心配で不安だった",
                "寝不足による集中力や気力不足の発生に不安があった",
                "ホテル宿泊などの外泊で環境がいつもと違ったので、入眠や睡眠時間に不安を感じた",
            ],
            "焦り": [
                "昼寝を長時間したので、寝られるか焦りがあった",
                "寝る前にカフェイン摂取したりニコチンを摂取したので、寝られるか焦った",
                "寝具の中で眠れないと悲観的になり、焦りがあった",
                "眠れないと健康面での支障や、仕事面での支障を感じ焦りがあった",
                "時計や目覚まし時計を見て睡眠時間を考えると焦りが出た",
                "早く起きなければならないなど、寝られる時間が限られていて入眠に焦りがあった",
                "眠れないと取り返しがつかないと焦りがあった",
                "ホテル宿泊などの外泊で環境がいつもと違ったので、寝られるかどうか焦りがあった",
            ],
            "緊張、ストレス感":[
            "寝室や寝具に入ると緊張してしまった",
            "夜中に何度も起きたり、15分くらいかそれ以上の中途覚醒があってストレスを感じた",
            "中途覚醒してトイレに何度も行って不快だった",
            "眠るまでの時間や起きるまでの時間がゆっくり感じてストレスだった",
            "恐怖を感じる悪夢をみた、もしくは悪夢を見ないか恐怖があった",
            "かなしばりのような感覚があった",
            "かなり長い時間夢を見ている感覚があり、ストレスを感じた",
            "ホテル宿泊の外泊で環境がいつもと違ったので、寝られるか緊張した"
            ],
            "期待への不満":[
            "眠りが浅いことへの不満があった", 
            "眠る環境が悪いと感じて寝れた気がせず不満だった",
            "自分の期待した時間寝られなかったことに悲観的になり、不満があった",
            "若い頃と同じ睡眠パターンを維持できると期待していて悲観的になった",
            "リラックスや環境改善したのに、期待通りの睡眠ができず不満や悲観があった",
            "ストレスや心配事があると絶対に眠れないと決めつけてしまっていた",
            "睡眠薬を飲まないと絶対に眠れないと信じ込み、寝つきや質が悪いと感じた" ,
            "寝る前の習慣を1つでも忘れたので、寝られないと思い込んだ" ,
            "外泊などで睡眠環境が違ったので、寝られないと思い込んだ" ,
            ]
        }

        self.bad_point_vars = {}
        for category, points in self.bad_points_categories.items():
            category_frame = ttk.Frame(notebook)
            notebook.add(category_frame, text=category)
            self.create_bad_points_tab(category_frame, points, category)

        # 自由記入欄のタブ
        free_text_frame = ttk.Frame(notebook)
        notebook.add(free_text_frame, text="自由記入")
        self.create_free_text_tab(free_text_frame)

        ttk.Button(self.feedback_window, text="記録する", command=self.save_feedback).pack(pady=10)

    def update_info(self):
        info = ""
        if self.sleep_time:
            info += f"睡眠開始: {self.sleep_time.strftime('%Y-%m-%d %H:%M')}\n"
        else:
            info += "睡眠開始: 未記録\n"
        
        if self.wake_time:
            info += f"起床時間: {self.wake_time.strftime('%Y-%m-%d %H:%M')}\n"
        else:
            info += "起床時間: 未記録\n"
        
        if self.sleep_time and self.wake_time:
            sleep_duration = self.calculate_sleep_duration(self.sleep_time, self.wake_time)
            info += f"睡眠時間: {sleep_duration}\n"
        else:
            info += "睡眠時間: 計算不可\n"
        
        self.info_label.config(text=info)

    def create_practiced_tab(self, parent_frame):
        canvas = tk.Canvas(parent_frame)
        scrollbar = ttk.Scrollbar(parent_frame, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)

        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )

        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        self.practiced_points = [
            "睡眠制限で、規則正しい就寝,起床時間を維持できた（多少の前後は気にしない）",
            "睡眠時間の把握や、質の良い睡眠時間がわかってきた",
            "睡眠制限により、以前より少し早く眠れるようになった気がする",
            "睡眠準備で、何か習慣化できることを探した、行ってみた",
            "睡眠準備で、リラックスする方法を探した、行ってみた",
            "睡眠環境整備で、室温を考えたり、寝具を変えてみた",
            "寝る前のカフェイン、アルコール、ニコチンの摂取を避けてみた",
            "寝る前にパソコンやスマートフォン等のブルーライトを避けてみた",
            "データと自分の認知を見直し、眠りの質について考える機会を持ち、意識を変えてみた",
            "データと自分の認知を見直し、期待と実際の睡眠時間のギャップを考えてみた",
            "データと自分の認知を見直し、リラックスや環境改善の効果について考えた",
            "データと自分の認知を見直し、就寝前の習慣の重要性を考え、意識を変えてみた",
        ]

        self.practiced_point_vars = []
        for item in self.practiced_points:
            var = tk.BooleanVar()
            ttk.Checkbutton(scrollable_frame, text=item, variable=var).pack(anchor="w", pady=2)
            self.practiced_point_vars.append(var)

        explanation_label = ttk.Label(scrollable_frame, 
                                      text="実際に実践した内容を自由記入欄に書いてみましょう。\nAIの回答がより正確になる可能性があります。", 
                                      wraplength=400, 
                                      font=("", 12, "bold"))
        explanation_label.pack(anchor="w", pady=10)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

    def create_improved_tab(self, parent_frame):
        canvas = tk.Canvas(parent_frame)
        scrollbar = ttk.Scrollbar(parent_frame, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)

        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )

        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        self.improved_points = [
            "日中の眠気が以前より改善した気がする",
            "よく寝れた（気がするだけでも大丈夫です）",
            "熟睡できた感覚があった",
            "睡眠の質が向上した気がする",
            "目覚めがすっきりしている",
            "睡眠にストレスを感じなかった",
            "入眠がスムーズだった",
            "途中覚醒が少なかった、もしくは無かった",
            "全体的に睡眠パターンが改善してきたと感じる",
            "認知の変化で、睡眠に対する不安が少し和らいだ感じがする",
            "認知の変化で、眠れないことへの焦りが以前より減った感じがする",
            "認知の変化で、睡眠時間にこだわりすぎないようになった",
            "認知の変化で、夜中に目覚めても、以前より落ち着いて対処できたと思う",
            "睡眠薬が良く効いていた気がする",
            "睡眠薬を減らせるかもと自信がついてきたので、医師や専門家に相談してみたい",
            "医師や専門家に相談して睡眠薬を減らしても、睡眠の傾向が良かったと思う"
        ]

        self.improved_point_vars = []
        for item in self.improved_points:
            var = tk.BooleanVar()
            ttk.Checkbutton(scrollable_frame, text=item, variable=var).pack(anchor="w", pady=2)
            self.improved_point_vars.append(var)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

    def create_bad_points_tab(self, parent_frame, points, category):
        canvas = tk.Canvas(parent_frame)
        scrollbar = ttk.Scrollbar(parent_frame, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)

        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )

        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        self.bad_point_vars[category] = []
        for item in points:
            var = tk.BooleanVar()
            ttk.Checkbutton(scrollable_frame, text=item, variable=var).pack(anchor="w", pady=2)
            self.bad_point_vars[category].append(var)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

    def create_free_text_tab(self, parent_frame):
        ttk.Label(parent_frame, text="自由記入欄:", font=("", 12, "bold")).pack(anchor="w", pady=5)
        self.free_text = scrolledtext.ScrolledText(parent_frame, height=10, width=50)
        self.free_text.pack(pady=5, fill="both", expand=True)

    def save_feedback(self):
        now = datetime.now()
        
        practiced_feedback = [item for item, var in zip(self.practiced_points, self.practiced_point_vars) if var.get()]
        practiced_feedback_str = ','.join(practiced_feedback)
        
        improved_feedback = [item for item, var in zip(self.improved_points, self.improved_point_vars) if var.get()]
        improved_feedback_str = ','.join(improved_feedback)
        
        bad_feedback = {}
        bad_feedback_str = ""
        for category, vars in self.bad_point_vars.items():
            category_points = [item for item, var in zip(self.bad_points_categories[category], vars) if var.get()]
            if category_points:
                bad_feedback[category] = category_points
                bad_feedback_str += f"{category}: {', '.join(category_points)}\n"
        
        free_text = self.free_text.get("1.0", tk.END).strip()

        sleep_duration = self.calculate_sleep_duration(self.sleep_time, self.wake_time)

        conn = sqlite3.connect('sleep_data.db')
        c = conn.cursor()
        yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")
        c.execute("SELECT therapy_notes FROM sleep_records WHERE date = ?", (yesterday,))
        result = c.fetchone()
        previous_notes = result[0] if result else ""

        user_input = f"睡眠時間: {sleep_duration}\n"
        user_input += f"実践したこと: {practiced_feedback_str}\n"
        user_input += f"改善が見られた点: {improved_feedback_str}\n"
        user_input += f"気になった点:\n{bad_feedback_str}\n"
        user_input += f"自由記入: {free_text}\n"
       # user_input += f"前日の取り組み: {previous_notes}"
        
        ai_advice = self.generate_ai_response(user_input)
        if len(ai_advice) > 400:  
            ai_advice = ai_advice[:400]

        sleep_date = self.sleep_date_entry.get()
        sleep_time = self.sleep_time_entry.get()
        if sleep_date != "YYYY-MM-DD" and sleep_time != "HH:MM":
            sleep_datetime = f"{sleep_date} {sleep_time}"
        else:
            sleep_datetime = self.sleep_time.strftime("%Y-%m-%d %H:%M:%S") if self.sleep_time else None

        c.execute("""INSERT INTO sleep_records 
                (date, sleep_time, wake_time, nap_time, good_points, good_points_free, 
                bad_points, bad_points_free, therapy_notes, ai_advice, sleep_duration, practiced_points)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (self.wake_time.strftime("%Y-%m-%d"),
            self.sleep_time.strftime("%Y-%m-%d %H:%M:%S"),
            self.wake_time.strftime("%Y-%m-%d %H:%M:%S"),
            self.nap_time.strftime("%Y-%m-%d %H:%M:%S") if self.nap_time else None,
            improved_feedback_str,
            free_text,
            json.dumps(bad_feedback),
            "",
            "",
            ai_advice,
            sleep_duration,
            practiced_feedback_str))

        conn.commit()
        conn.close()

        self.feedback_window.destroy()
        self.reset_daily_data()
        messagebox.showinfo("記録完了", "睡眠記録が保存されました。")
        self.show_recent_history()

    def reset_daily_data(self):
        self.sleep_time = None
        self.wake_time = None
        self.nap_time = None
        self.update_info()

    def show_recent_history(self):
        for widget in self.history_frame.winfo_children():
            widget.destroy()

        warning_text = "※ AIの助言は参考情報であり、必ずしも正確とは限りません。判断に迷う場合や症状が辛い時は、必ず医師に相談してください。"
        warning_label = ttk.Label(self.history_frame, text=warning_text, wraplength=550, foreground="red", font=("", 10, "bold"))
        warning_label.pack(pady=(10, 5))

        ttk.Label(self.history_frame, text="過去7日間の睡眠履歴", font=("", 12, "bold")).pack(pady=5)

        canvas = tk.Canvas(self.history_frame)
        scrollbar = ttk.Scrollbar(self.history_frame, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)

        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(
                scrollregion=canvas.bbox("all")
            )
        )

        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        conn = sqlite3.connect('sleep_data.db')
        c = conn.cursor()
        seven_days_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        c.execute("SELECT * FROM sleep_records WHERE date >= ? ORDER BY date DESC", (seven_days_ago,))
        records = c.fetchall()
        conn.close()

        for record in records:
            self.create_recent_record_display(scrollable_frame, record)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

    def create_recent_record_display(self, parent_frame, record):
        record_frame = ttk.Frame(parent_frame)
        record_frame.pack(fill="x", expand=True, pady=5)

        info_frame = ttk.Frame(record_frame)
        info_frame.pack(side="left", fill="x", expand=True)

        ttk.Label(info_frame, text=f"日付: {record[0]}", wraplength=550).pack(anchor="w")
        ttk.Label(info_frame, text=f"就寝時間: {record[1]}", wraplength=550).pack(anchor="w")
        ttk.Label(info_frame, text=f"起床時間: {record[2]}", wraplength=550).pack(anchor="w")
        ttk.Label(info_frame, text=f"睡眠時間: {record[10]}", wraplength=550).pack(anchor="w")
        if record[3]:
            ttk.Label(info_frame, text=f"昼寝時間: {record[3]}", wraplength=550).pack(anchor="w")

        if len(record) > 9 and record[9]:
            ttk.Label(info_frame, text="AIからの助言:", wraplength=550, font=("", 10, "bold")).pack(anchor="w")
            ai_advice_label = ttk.Label(info_frame, text=record[9], wraplength=550)
            ai_advice_label.pack(anchor="w", pady=5)

        ttk.Separator(parent_frame, orient='horizontal').pack(fill='x', pady=5)

    def show_history(self):
        history_window = tk.Toplevel(self.master)
        history_window.title("睡眠履歴")
        history_window.geometry("800x900")

        notebook = ttk.Notebook(history_window)
        notebook.pack(fill="both", expand=True)

        def refresh_history():
            for widget in notebook.winfo_children():
                widget.destroy()
            self.populate_history(notebook)

        self.populate_history(notebook)

        refresh_button = ttk.Button(history_window, text="履歴を更新", command=refresh_history)
        refresh_button.pack(pady=10)

    def populate_history(self, notebook):
        conn = sqlite3.connect('sleep_data.db')
        c = conn.cursor()
        c.execute("SELECT * FROM sleep_records ORDER BY date DESC")
        records = c.fetchall()
        conn.close()

        classified_records = defaultdict(lambda: defaultdict(list))
        for record in records:
            date = datetime.strptime(record[0], "%Y-%m-%d")
            year = date.year
            month = date.month
            classified_records[year][month].append(record)

        for year in sorted(classified_records.keys(), reverse=True):
            year_frame = ttk.Frame(notebook)
            notebook.add(year_frame, text=str(year))

            year_notebook = ttk.Notebook(year_frame)
            year_notebook.pack(fill="both", expand=True)

            for month in sorted(classified_records[year].keys(), reverse=True):
                month_frame = ttk.Frame(year_notebook)
                year_notebook.add(month_frame, text=f"{month}月")

                canvas = tk.Canvas(month_frame)
                scrollbar = ttk.Scrollbar(month_frame, orient="vertical", command=canvas.yview)
                scrollable_frame = ttk.Frame(canvas)

                scrollable_frame.bind(
                    "<Configure>",
                    lambda e: canvas.configure(
                        scrollregion=canvas.bbox("all")
                    )
                )

                canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
                canvas.configure(yscrollcommand=scrollbar.set)

                for record in classified_records[year][month]:
                    self.create_record_display(scrollable_frame, record)

                canvas.pack(side="left", fill="both", expand=True)
                scrollbar.pack(side="right", fill="y")

    def create_record_display(self, parent_frame, record):
        record_frame = ttk.Frame(parent_frame)
        record_frame.pack(fill="x", expand=True, pady=5)

        info_frame = ttk.Frame(record_frame)
        info_frame.pack(side="left", fill="x", expand=True)

        ttk.Label(info_frame, text=f"日付: {record[0]}", wraplength=550).pack(anchor="w")
        ttk.Label(info_frame, text=f"就寝時間: {record[1]}", wraplength=550).pack(anchor="w")
        ttk.Label(info_frame, text=f"起床時間: {record[2]}", wraplength=550).pack(anchor="w")
        ttk.Label(info_frame, text=f"睡眠時間: {record[10]}", wraplength=550).pack(anchor="w")
        if record[3]:
            ttk.Label(info_frame, text=f"昼寝時間: {record[3]}", wraplength=550).pack(anchor="w")

        ai_frame = ttk.Frame(info_frame)
        ai_frame.pack(fill="x", expand=True, pady=5)

        ttk.Label(ai_frame, text="AIからの助言:", wraplength=550, font=("", 10, "bold")).pack(anchor="w")
        ai_advice_label = ttk.Label(ai_frame, text=record[9] if record[9] else "助言なし", wraplength=550)
        ai_advice_label.pack(anchor="w", pady=5)

        improved_points = record[4].split(',') if record[4] else []
        bad_points = json.loads(record[6]) if record[6] else {}
        practiced_points = record[11].split(',') if record[11] else []
        
        if practiced_points:
            ttk.Label(info_frame, text="実践したこと:", wraplength=550, font=("", 10, "bold")).pack(anchor="w")
            for point in practiced_points:
                ttk.Label(info_frame, text=f"- {point}", wraplength=550).pack(anchor="w")

        if improved_points:
            ttk.Label(info_frame, text="改善が見られた点:", wraplength=550, font=("", 10, "bold")).pack(anchor="w")
            for point in improved_points:
                ttk.Label(info_frame, text=f"- {point}", wraplength=550).pack(anchor="w")
    
        if record[5]:  # good_points_free
            ttk.Label(info_frame, text="自由記入欄:", wraplength=550, font=("", 10, "bold")).pack(anchor="w")
            ttk.Label(info_frame, text=record[5], wraplength=550).pack(anchor="w")
    
        if bad_points:
            ttk.Label(info_frame, text="気になった点:", wraplength=550, font=("", 10, "bold")).pack(anchor="w")
            for category, points in bad_points.items():
                ttk.Label(info_frame, text=f"{category}:", wraplength=550).pack(anchor="w")
                for point in points:
                    ttk.Label(info_frame, text=f"- {point}", wraplength=550).pack(anchor="w")

        button_frame = ttk.Frame(record_frame)
        button_frame.pack(side="right", padx=5)

        ttk.Button(button_frame, text="削除", 
                   command=lambda: self.delete_record(record[0], record[2], record_frame)).pack(side="top", pady=2)

        ttk.Separator(parent_frame, orient='horizontal').pack(fill='x', pady=5)

    def delete_record(self, date, time, frame):
        if messagebox.askyesno("削除確認", f"{date}の記録を削除しますか？"):
            conn = sqlite3.connect('sleep_data.db')
            c = conn.cursor()
            c.execute("DELETE FROM sleep_records WHERE date = ? AND wake_time = ?", (date, time))
            conn.commit()
            conn.close()
            frame.destroy()
            messagebox.showinfo("削除完了", "記録が削除されました。")
            self.show_recent_history()

    def calculate_sleep_duration(self, sleep_time, wake_time):
        if sleep_time and wake_time:
            duration = wake_time - sleep_time
            
            # 日付をまたぐ場合の処理
            if duration.total_seconds() < 0:
                duration += timedelta(days=1)
            
            hours, remainder = divmod(duration.total_seconds(), 3600)
            minutes, _ = divmod(remainder, 60)
            
            return f"{int(hours)}時間{int(minutes)}分"
        else:
            return "データなし"
        
    def clear_placeholder(self, event, placeholder):
        if event.widget.get() == placeholder:
            event.widget.delete(0, tk.END)

    def restore_placeholder(self, event, placeholder):
        if event.widget.get() == "":
            event.widget.insert(0, placeholder)

if __name__ == "__main__":
    root = tk.Tk()
    app = SleepTherapyApp(root)
    root.mainloop()
