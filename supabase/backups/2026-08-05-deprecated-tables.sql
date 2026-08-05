--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: calc_event_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calc_event_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    event_type text NOT NULL,
    level smallint,
    signature text,
    detail jsonb,
    CONSTRAINT calc_event_log_event_type_check CHECK ((event_type = ANY (ARRAY['level_up'::text, 'level_down'::text, 'review_pass'::text, 'review_fail'::text, 'assault_mode_on'::text, 'forced_problem'::text])))
);


--
-- Name: calc_level_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calc_level_state (
    user_id uuid NOT NULL,
    level smallint NOT NULL,
    status text DEFAULT 'practicing'::text NOT NULL,
    abc_passed_date date,
    review_r1_date date,
    review_r2_date date,
    review_r3_date date,
    session_count_in_level integer DEFAULT 0 NOT NULL,
    warmup_complete boolean DEFAULT false NOT NULL,
    warmup_answered integer DEFAULT 0 NOT NULL,
    last_session_accuracy real,
    consecutive_poor_sessions integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT calc_level_state_status_check CHECK ((status = ANY (ARRAY['practicing'::text, 'abc_passed'::text, 'review_r1'::text, 'review_r2'::text, 'review_r3'::text, 'mastered'::text])))
);


--
-- Name: robot_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.robot_tasks (
    id text NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    start_time text NOT NULL,
    end_time text NOT NULL,
    reward_coins integer DEFAULT 10 NOT NULL,
    quick_link text DEFAULT ''::text NOT NULL,
    completed_at timestamp with time zone,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vocabulary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vocabulary (
    id integer NOT NULL,
    unit text,
    lesson text,
    word text,
    explanation text,
    ipa text,
    example_sentence text,
    source text,
    familiarity integer DEFAULT 0
);


--
-- Name: vocabulary_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vocabulary_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vocabulary_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vocabulary_id_seq OWNED BY public.vocabulary.id;


--
-- Name: vocabulary id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary ALTER COLUMN id SET DEFAULT nextval('public.vocabulary_id_seq'::regclass);


--
-- Data for Name: calc_event_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.calc_event_log (id, user_id, occurred_at, event_type, level, signature, detail) FROM stdin;
\.


--
-- Data for Name: calc_level_state; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.calc_level_state (user_id, level, status, abc_passed_date, review_r1_date, review_r2_date, review_r3_date, session_count_in_level, warmup_complete, warmup_answered, last_session_accuracy, consecutive_poor_sessions, updated_at) FROM stdin;
2628ec9b-31fe-49ab-9f08-c0a90fd1b5e1	7	practicing	\N	\N	\N	\N	2	t	36	1	0	2026-05-19 01:17:56.571+00
ec00ec5e-4d80-42fb-9687-be775d8b29db	6	practicing	\N	\N	\N	\N	4	t	80	1	0	2026-05-24 04:23:14.705+00
5b92e02a-1c34-46f2-b441-6142678c894f	7	practicing	\N	\N	\N	\N	4	t	106	1	0	2026-05-24 04:33:01.631+00
ec00ec5e-4d80-42fb-9687-be775d8b29db	10	practicing	\N	\N	\N	\N	1	t	30	1	0	2026-05-24 04:35:53.568+00
f7e98c39-1714-46a0-b2b1-38e08a80f78f	1	practicing	\N	\N	\N	\N	2	t	20	1	0	2026-05-26 04:11:19.337+00
\.


--
-- Data for Name: robot_tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.robot_tasks (id, user_id, title, content, start_time, end_time, reward_coins, quick_link, completed_at, sort_order, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: vocabulary; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vocabulary (id, unit, lesson, word, explanation, ipa, example_sentence, source, familiarity) FROM stdin;
1	Unit 1	Lesson 1	a great time	a fun and happy time doing something you enjoy	/ə ɡreɪt taɪm/	We had a great time at the amusement park last weekend.	houhai	0
2	Unit 1	Lesson 1	Look at the time!	used to show surprise about what time it is, often when it's later than expected	/lʊk æt ðə taɪm/	Look at the time! It's already midnight and we haven't finished yet.	houhai	0
3	Unit 1	Lesson 1	on time	at the arranged or correct time; not late	/ɒn taɪm/	The train arrived on time, so we didn't miss our connection.	houhai	0
4	Unit 1	Lesson 1	waste (one's) time	to use time doing something that is not useful or fun	/weɪst taɪm/	Don't waste your time watching TV when you could be studying.	houhai	0
5	Unit 1	Lesson 1	time for	the right or planned moment to do something	/taɪm fɔː/	It's time for dinner — please come to the table.	houhai	0
6	Unit 1	Lesson 1	laugh	to make the sounds and movements of your face that show you think something is funny or silly	/lɑːf/	The children began to laugh when the clown fell over.	houhai	0
7	Unit 1	Lesson 1	enjoy	to have fun or feel happy when doing something	/ɪnˈdʒɔɪ/	I really enjoy reading books on rainy afternoons.	houhai	0
8	Unit 1	Lesson 1	grandchild	a child of your son or daughter	/ˈɡræntʃaɪld/	My grandmother loves spending time with her grandchild.	houhai	0
9	Unit 1	Lesson 1	lazy	unwilling to work or be active; doing as little as possible	/ˈleɪzi/	He's so lazy that he won't even wash his own dishes.	houhai	0
10	Unit 1	Lesson 1	only child	a child who has no brothers or sisters	/ˈəʊnli tʃaɪld/	As an only child, she never had to share her toys.	houhai	0
11	Unit 1	Lesson 1	nephew	the son of your brother or sister	/ˈnefjuː/	My nephew loves playing football every Saturday morning.	houhai	0
12	Unit 1	Lesson 1	niece	the daughter of your brother or sister	/niːs/	I bought a birthday present for my niece who just turned seven.	houhai	0
13	Unit 1	Lesson 1	waste	to use too much of something or use something badly when there is a limited amount of it	/weɪst/	Please don't waste food — many people around the world are hungry.	houhai	0
14	Unit 1	Lesson 2	population	a particular group of people or animals living in a particular area	/ˌpɒpjuˈleɪʃən/	The population of China is over one billion people.	houhai	0
15	Unit 1	Lesson 2	hunt	to go after wild animals in order to catch or kill them for food, sport or to make money	/hʌnt/	Lions hunt in groups to catch large animals on the savanna.	houhai	0
16	Unit 1	Lesson 2	hurt	to cause physical pain to somebody/yourself; to injure somebody/yourself	/hɜːt/	She hurt her ankle when she fell off her bicycle.	houhai	0
17	Unit 1	Lesson 2	protect	to make sure that somebody/something is not harmed, injured, damaged, etc.	/prəˈtekt/	The thick fur helps the polar bear protect itself from the cold.	houhai	0
18	Unit 1	Lesson 2	danger	the possibility of something happening that will injure, harm or kill somebody, or damage or destroy something	/ˈdeɪndʒə/	The hikers were unaware of the danger lurking in the dark forest.	houhai	0
19	Unit 1	Lesson 2	kill	to make somebody/something die	/kɪl/	Pollution can kill fish and other wildlife in rivers.	houhai	0
20	Unit 1	Lesson 2	care for	to look after somebody who is sick, very old, very young, etc.	/keə fɔː/	She volunteers at the shelter to care for abandoned animals.	houhai	0
21	Unit 1	Lesson 2	frightened of	feeling scared or afraid about something specific	/ˈfraɪtənd ɒv/	The little boy was frightened of the loud thunder during the storm.	houhai	0
22	Unit 1	Lesson 2	in fact	used to give extra details about something that has just been mentioned	/ɪn fækt/	The journey looked short on the map; in fact, it took five hours.	houhai	0
23	Unit 1	Lesson 2	look after	to be responsible for or to take care of somebody/something/yourself	/lʊk ˈɑːftə/	Can you look after my cat while I'm on holiday?	houhai	0
24	Unit 1	Lesson 2	reach	to come to somebody's attention	/riːtʃ/	We finally reached the top of the mountain after six hours of climbing.	houhai	0
25	Unit 1	Lesson 2	livestock	the animals kept on a farm, for example cows or sheep	/ˈlaɪvstɒk/	The farmer checks his livestock every morning to make sure they are healthy.	houhai	0
26	Unit 1	Lesson 2	roar	a loud deep sound made by an animal, especially a lion, or by somebody's voice	/rɔː/	We could hear the lion roar from far away across the grassland.	houhai	0
27	Unit 1	Lesson 2	big cat	Any large wild animal of the cat family. Lions, tigers and leopards are all big cats.	/bɪɡ kæt/	The leopard is a big cat that is known for its spotted coat.	houhai	0
28	Unit 1	Lesson 2	conservationist	a person who takes an active part in the protection of the environment	/ˌkɒnsəˈveɪʃənɪst/	The conservationist spent years working to save endangered rhinos.	houhai	0
29	Unit 1	Lesson 2	frightening	making you feel afraid	/ˈfraɪtənɪŋ/	Walking alone in the dark forest at night was a frightening experience.	houhai	0
30	Unit 1	Lesson 2	initiative	a new plan for dealing with a particular problem or for achieving a particular purpose	/ɪˈnɪʃətɪv/	The government launched an initiative to plant one million trees.	houhai	0
31	Unit 1	Lesson 2	million	1,000,000	/ˈmɪljən/	Over a million people visited the museum last year.	houhai	0
32	Unit 1	Lesson 2	affect	to produce a change in somebody/something	/əˈfekt/	Air pollution can badly affect the health of young children.	houhai	0
33	Unit 1	Lesson 3	diver	a person who swims underwater using special equipment, usually for their job	/ˈdaɪvə/	The diver explored the colourful coral reef beneath the ocean.	houhai	0
34	Unit 2	Lesson 1	pay	to give somebody money for work, goods, services, etc.	/peɪ/	I need to pay the bill before we leave the restaurant.	houhai	0
35	Unit 2	Lesson 1	save (money)	to keep money instead of spending it, especially in order to buy a particular thing	/seɪv/	She decided to save money every month to buy a new laptop.	houhai	0
36	Unit 2	Lesson 1	awful	very bad or unpleasant	/ˈɔːfəl/	The weather was awful — it rained all day without stopping.	houhai	0
37	Unit 2	Lesson 1	careful	giving attention or thought to what you are doing so that you avoid hurting yourself, damaging something or doing something wrong	/ˈkeəfəl/	Be careful when you cross the road — always look both ways.	houhai	0
38	Unit 2	Lesson 1	hate	to dislike somebody/something very much	/heɪt/	I hate waking up early on cold winter mornings.	houhai	0
39	Unit 2	Lesson 1	rich	having a lot of money or property	/rɪtʃ/	The rich businessman donated a large amount of money to charity.	houhai	0
189	Unit 6	Lesson 1	elbow	the joint where your arm bends	/ˈelbəʊ/	He bumped his elbow on the edge of the table and winced in pain.	houhai	0
40	Unit 2	Lesson 1	armchair	a comfortable chair with sides on which you can rest your arms	/ˈɑːmtʃeə/	Grandpa fell asleep in his armchair while watching television.	houhai	0
41	Unit 2	Lesson 1	coffee table	a small low table for putting magazines, cups, etc. on, usually in front of a sofa	/ˈkɒfi ˌteɪbəl/	She put the magazines and remote control on the coffee table.	houhai	0
42	Unit 2	Lesson 1	fridge	a piece of electrical equipment in which food is kept cold so that it stays fresh	/frɪdʒ/	Please put the leftover soup in the fridge so it doesn't go bad.	houhai	0
43	Unit 2	Lesson 1	oven	the part of a cooker that is like a box with a door on the front, in which food is cooked or heated	/ˈʌvən/	She preheated the oven before putting the cake inside to bake.	houhai	0
44	Unit 2	Lesson 1	shower	a piece of equipment producing a flow of water that you stand under to wash yourself	/ˈʃaʊə/	I take a shower every morning before going to school.	houhai	0
45	Unit 2	Lesson 1	sink	a large open container in a kitchen that has taps to supply water and that you use for washing dishes in	/sɪŋk/	He stood at the sink and washed his hands before dinner.	houhai	0
46	Unit 2	Lesson 1	sofa	a long comfortable seat with a back and arms, for two or more people to sit on	/ˈsəʊfə/	The family sat together on the sofa to watch a film.	houhai	0
47	Unit 2	Lesson 1	toilet	a large bowl attached to a pipe that you sit on or stand over when you get rid of waste matter from your body	/ˈtɔɪlɪt/	The plumber was called to fix the broken toilet in the bathroom.	houhai	0
48	Unit 2	Lesson 1	wardrobe	a large cupboard for hanging clothes in, which is either a piece of furniture or built into the wall	/ˈwɔːdrəʊb/	She opened the wardrobe and chose a dress to wear to the party.	houhai	0
49	Unit 2	Lesson 1	move in	to start to live in your new home	/muːv ɪn/	We move in to our new apartment next Saturday.	houhai	0
50	Unit 2	Lesson 1	move out	to leave your old home	/muːv aʊt/	He decided to move out of his parents' house after getting a job.	houhai	0
51	Unit 2	Lesson 2	furniture	objects that can be moved, such as tables, chairs and beds, that are put into a house or an office to make it suitable for living or working in	/ˈfɜːnɪtʃə/	They bought new furniture for the living room after moving in.	houhai	0
52	Unit 2	Lesson 2	glass	a hard, usually clear, substance used, for example, for making windows and bottles	/ɡlɑːs/	The window is made of glass, so be careful not to break it.	houhai	0
53	Unit 2	Lesson 2	modern	using the latest technology, designs, materials, ideas, etc.	/ˈmɒdən/	The architect designed a modern building with large glass windows.	houhai	0
54	Unit 2	Lesson 2	plastic	made of plastic (=a light strong material that is produced by chemical processes and can be formed into shapes when heated)	/ˈplæstɪk/	The plastic bottles were collected and sent to a recycling plant.	houhai	0
55	Unit 2	Lesson 2	reuse	to use something again	/ˌriːˈjuːz/	We reuse shopping bags to reduce the amount of plastic waste.	houhai	0
56	Unit 2	Lesson 2	rubbish	things that you throw away because you no longer want or need them	/ˈrʌbɪʃ/	Please put your rubbish in the bin and not on the street.	houhai	0
57	Unit 2	Lesson 2	earthquake	a sudden, violent shaking of the earth's surface	/ˈɜːθkweɪk/	The earthquake damaged many buildings in the city centre.	houhai	0
58	Unit 2	Lesson 2	balcony	a platform that is built on the upstairs outside wall of a building, with a wall or rail around it	/ˈbælkəni/	She sat on the balcony and enjoyed the view of the sea.	houhai	0
59	Unit 2	Lesson 2	vacuum cleaner	an electrical machine that cleans floors, carpets, etc. by sucking up dirt and dust	/ˈvækjuəm ˌkliːnə/	He used the vacuum cleaner to clean the carpet in the living room.	houhai	0
60	Unit 2	Lesson 2	bookcase	a piece of furniture with shelves for keeping books on	/ˈbʊkkeɪs/	The bookcase in her study was filled with hundreds of novels.	houhai	0
61	Unit 2	Lesson 2	washing machine	an electric machine for washing clothes	/ˈwɒʃɪŋ məˌʃiːn/	She put all the dirty clothes into the washing machine before leaving.	houhai	0
62	Unit 2	Lesson 2	floor	the surface of a room that you walk on	/flɔː/	The children sat on the floor and played with their toys.	houhai	0
63	Unit 2	Lesson 2	microwave oven	a type of oven that cooks or heats food very quickly using electromagnetic waves rather than heat	/ˈmaɪkrəweɪv ˌʌvən/	She used the microwave oven to reheat her leftover pasta.	houhai	0
64	Unit 2	Lesson 2	roof	the structure that covers or forms the top of a building or vehicle	/ruːf/	The heavy snow put too much weight on the roof of the old barn.	houhai	0
65	Unit 2	Lesson 2	rug	a piece of thick material like a small carpet that is used for covering or decorating part of a floor	/rʌɡ/	They placed a colourful rug in front of the fireplace.	houhai	0
66	Unit 2	Lesson 2	recycle	to treat things that have already been used so that they can be used again	/ˌriːˈsaɪkəl/	It's important to recycle paper, glass, and plastic to protect the environment.	houhai	0
67	Unit 2	Lesson 2	ecological	connected with the relation of plants and living creatures to each other and to their environment	/ˌiːkəˈlɒdʒɪkəl/	The school started an ecological project to clean up the local river.	houhai	0
68	Unit 2	Lesson 2	type	a kind or sort	/taɪp/	What type of music do you enjoy listening to the most?	houhai	0
69	Unit 2	Lesson 3	sitting room	a room in a house where people sit together, watch television, etc.	/ˈsɪtɪŋ ruːm/	The family gathered in the sitting room after dinner to chat.	houhai	0
70	Unit 2	Lesson 3	appliance	a machine that is designed to do a particular thing in the home, such as preparing food, heating or cleaning	/əˈplaɪəns/	The kitchen was filled with modern appliances like a dishwasher and blender.	houhai	0
71	Unit 2	Lesson 3	throw away	to get rid of something that you no longer want	/θrəʊ əˈweɪ/	Don't throw away those old newspapers — we can recycle them.	houhai	0
72	Unit 2	Lesson 3	late	arriving, happening or done after the expected, arranged or usual time	/leɪt/	She was late for school because she missed the bus.	houhai	0
73	Unit 3	Lesson 1	deep	having a large distance from the top or surface to the bottom	/diːp/	The lake is so deep that sunlight can barely reach the bottom.	houhai	0
74	Unit 3	Lesson 1	wrong	causing problems or difficulties; not as it should be	/rɒŋ/	I got the answer wrong because I misread the question.	houhai	0
75	Unit 3	Lesson 1	dive	to jump into water with your head and arms going in first	/daɪv/	He took a deep breath and prepared to dive into the swimming pool.	houhai	0
190	Unit 6	Lesson 1	knee	the joint that bends at the middle of your leg	/niː/	The footballer injured his knee during the game and had to be substituted.	houhai	0
76	Unit 3	Lesson 1	equipment	the things that are needed for a particular purpose or activity	/ɪˈkwɪpmənt/	The climbers checked their equipment carefully before starting the ascent.	houhai	0
77	Unit 3	Lesson 1	explore	to travel to or around an area or a country in order to learn about it	/ɪkˈsplɔː/	The scientists set off to explore the deep caves in the mountains.	houhai	0
78	Unit 3	Lesson 1	hobby	an activity that you do for pleasure when you are not working	/ˈhɒbi/	His hobby is collecting stamps from countries around the world.	houhai	0
79	Unit 3	Lesson 1	sure	confident that you know something or that you are right	/ʃʊə/	Are you sure you locked the door before leaving the house?	houhai	0
80	Unit 3	Lesson 1	end up	to find yourself in a place or situation at the end of a process or period of time	/end ʌp/	We got lost and ended up in a small village far from our destination.	houhai	0
81	Unit 3	Lesson 1	give up	to stop trying to do something	/ɡɪv ʌp/	Don't give up — keep practising and you will improve.	houhai	0
82	Unit 3	Lesson 1	take up	to learn or start to do something, especially for pleasure	/teɪk ʌp/	She decided to take up painting after retiring from work.	houhai	0
83	Unit 3	Lesson 1	try out	to test or use somebody/something in order to see how good or effective they are	/traɪ aʊt/	Let's try out the new Italian restaurant that opened downtown.	houhai	0
84	Unit 3	Lesson 1	turn on	to start the flow of electricity, gas, water, etc. by moving a switch, button, etc.	/tɜːn ɒn/	He turned on the computer and started his homework.	houhai	0
85	Unit 3	Lesson 1	scuba diving	a sport or activity in which you swim underwater using an air tank and a special breathing machine that you strap on your body	/ˈskuːbə ˌdaɪvɪŋ/	She went scuba diving in the coral reef and saw amazing sea creatures.	houhai	0
86	Unit 3	Lesson 2	trick	a clever action that somebody/something performs as a way of entertaining people	/trɪk/	The skateboarder performed an impressive trick in front of the crowd.	houhai	0
87	Unit 3	Lesson 2	show off	to try to impress others by talking about your abilities, possessions, etc.	/ʃəʊ ɒf/	He loves to show off his new skateboard tricks at the park.	houhai	0
88	Unit 3	Lesson 2	hill	an area of land that is higher than the land around it, but not as high as a mountain	/hɪl/	We climbed to the top of the hill to get a better view of the valley.	houhai	0
89	Unit 3	Lesson 2	pull	to take hold of something and use force in order to move it or try to move it towards yourself	/pʊl/	She had to pull the heavy suitcase up the stairs.	houhai	0
90	Unit 3	Lesson 2	rope	very strong thick string made by twisting thinner strings, wires, etc. together	/rəʊp/	The sailors used a rope to tie the boat to the dock.	houhai	0
91	Unit 3	Lesson 2	slide	to move easily over a smooth or wet surface; to make something move in this way	/slaɪd/	The children love to slide down the snowy hill on their sledges.	houhai	0
92	Unit 3	Lesson 2	bored	feeling tired and impatient because you have lost interest in somebody/something or because you have nothing to do	/bɔːd/	She felt bored sitting alone at home with nothing to do.	houhai	0
93	Unit 3	Lesson 2	boring	not interesting; making you feel tired and impatient	/ˈbɔːrɪŋ/	The lecture was so boring that several students fell asleep.	houhai	0
94	Unit 3	Lesson 2	excited	feeling or showing happiness and enthusiasm	/ɪkˈsaɪtɪd/	The children were excited about their upcoming trip to the theme park.	houhai	0
95	Unit 3	Lesson 2	exciting	causing great interest or excitement	/ɪkˈsaɪtɪŋ/	Watching the final match of the championship was really exciting.	houhai	0
96	Unit 3	Lesson 2	interested	giving your attention to something because you enjoy finding out about it or doing it; showing interest in something and finding it exciting	/ˈɪntrɪstɪd/	She is very interested in learning about ancient history and culture.	houhai	0
97	Unit 3	Lesson 2	interesting	attracting your attention because it is/they are special, exciting or unusual	/ˈɪntrɪstɪŋ/	The documentary about deep-sea creatures was really interesting.	houhai	0
98	Unit 3	Lesson 2	relaxed	(of a person) calm and not anxious or worried	/rɪˈlækst/	After the holiday, she felt completely relaxed and refreshed.	houhai	0
99	Unit 3	Lesson 2	relaxing	helping you to rest and become less anxious	/rɪˈlæksɪŋ/	Listening to soft music in a warm bath is very relaxing.	houhai	0
100	Unit 3	Lesson 2	tired	feeling that you would like to sleep or rest; needing rest	/taɪəd/	After the long hike, everyone was too tired to cook dinner.	houhai	0
101	Unit 3	Lesson 2	tiring	making you feel the need to sleep or rest	/ˈtaɪərɪŋ/	Looking after young children all day can be very tiring.	houhai	0
102	Unit 3	Lesson 2	use up	to use all of something so that there is none left	/juːz ʌp/	We used up all the paint before finishing the second wall.	houhai	0
103	Unit 3	Lesson 3	pastime	something that you enjoy doing when you are not working	/ˈpɑːstaɪm/	Reading is her favourite pastime on long winter evenings.	houhai	0
104	Unit 3	Lesson 3	blog	a website on which someone writes about personal opinions, activities, and experiences	/blɒɡ/	She writes a popular travel blog about her adventures around the world.	houhai	0
105	Unit 3	Lesson 3	blog (verb)	to write something in a blog	/blɒɡ/	He blogs about technology and reviews the latest gadgets online.	houhai	0
106	Unit 3	Lesson 3	code	to change (information) into a set of letters, numbers, or symbols that can be read by a computer	/kəʊd/	She learned to code as a hobby and created her own mobile app.	houhai	0
107	Unit 3	Lesson 3	post	to put information or pictures on a website	/pəʊst/	He decided to post a photo of his meal on his social media page.	houhai	0
108	Unit 3	Lesson 3	link	a connection between documents on the internet	/lɪŋk/	She sent me a link to an interesting article about space travel.	houhai	0
109	Unit 3	Lesson 3	comment	something that you say or write that gives an opinion on or explains somebody/something	/ˈkɒment/	He left a kind comment on her blog post about cooking.	houhai	0
110	Unit 4	Lesson 1	Hang on!	used to ask someone to wait for a short time or to stop what they are doing	/hæŋ ɒn/	Hang on! I'll be ready to leave in just two minutes.	houhai	0
111	Unit 4	Lesson 1	have got no idea	you really don't know something at all	/hæv ɡɒt nəʊ aɪˈdɪə/	I've got no idea where I put my keys — I've been looking for ages.	houhai	0
112	Unit 4	Lesson 1	I don't believe it.	what you say when you're very surprised or shocked	/aɪ dəʊnt bɪˈliːv ɪt/	I don't believe it — he actually won first prize in the competition!	houhai	0
113	Unit 4	Lesson 1	have a snack	to eat a small amount of food between meals	/hæv ə snæk/	She decided to have a snack before dinner because she was hungry.	houhai	0
114	Unit 4	Lesson 1	Hurry up!	to do something more quickly because there is not much time	/ˈhʌri ʌp/	Hurry up! The bus is about to leave and we can't miss it.	houhai	0
115	Unit 4	Lesson 1	disgusting	extremely unpleasant	/dɪsˈɡʌstɪŋ/	The food left out overnight smelled absolutely disgusting.	houhai	0
116	Unit 4	Lesson 1	delicious	having a very pleasant taste or smell	/dɪˈlɪʃəs/	The homemade chocolate cake was absolutely delicious.	houhai	0
117	Unit 4	Lesson 1	full	having had enough to eat	/fʊl/	I couldn't eat dessert because I was already full from the main course.	houhai	0
118	Unit 4	Lesson 1	thirsty	needing or wanting to drink	/ˈθɜːsti/	After playing outside in the heat, the children were very thirsty.	houhai	0
119	Unit 4	Lesson 1	altogether	used to give a total number or amount	/ˌɔːltəˈɡeðə/	There were twelve students altogether on the school trip.	houhai	0
120	Unit 4	Lesson 1	buffet	a meal at which people serve themselves from a table and then stand or sit somewhere else to eat	/ˈbʊfeɪ/	The hotel offered a buffet breakfast with a wide variety of foods.	houhai	0
121	Unit 4	Lesson 1	lobby	a large area inside the entrance of a public building where people can meet and wait	/ˈlɒbi/	Guests checked in at the reception desk in the hotel lobby.	houhai	0
122	Unit 4	Lesson 2	meat	the soft part of an animal or a bird that can be eaten as food; a particular type of this	/miːt/	The restaurant offered a wide choice of meat dishes including beef and lamb.	houhai	0
123	Unit 4	Lesson 2	healthy	good for your health	/ˈhelθi/	Eating fruit and vegetables every day is a healthy habit.	houhai	0
124	Unit 4	Lesson 2	pot	a deep round container used for cooking things in	/pɒt/	She stirred the vegetable soup slowly in the large pot.	houhai	0
125	Unit 4	Lesson 2	raw	not cooked	/rɔː/	He sliced the raw vegetables and added them to the salad.	houhai	0
126	Unit 4	Lesson 2	sauce	a thick liquid that is eaten with food to add taste to it	/sɔːs/	She poured tomato sauce over the pasta and sprinkled cheese on top.	houhai	0
127	Unit 4	Lesson 2	seafood	fish and sea creatures that can be eaten, especially shellfish	/ˈsiːfuːd/	The coastal restaurant is famous for its fresh seafood dishes.	houhai	0
128	Unit 4	Lesson 2	soup	a liquid food made by boiling meat, vegetables, etc. in water, often eaten as the first course of a meal	/suːp/	On cold days, a bowl of hot soup is very comforting.	houhai	0
129	Unit 4	Lesson 2	add	to put something together with something else so as to increase the size, number, amount, etc.	/æd/	Add a pinch of salt to the boiling water before putting in the pasta.	houhai	0
130	Unit 4	Lesson 2	boil	when a liquid boils or when you boil it, it is heated to the point where it forms bubbles and turns to steam or vapour	/bɔɪl/	Boil the potatoes for twenty minutes until they are soft.	houhai	0
131	Unit 4	Lesson 2	chop	to cut something into pieces with a sharp tool such as a knife	/tʃɒp/	Chop the onions finely before adding them to the pan.	houhai	0
132	Unit 4	Lesson 2	fry	to cook something in hot fat or oil; to be cooked in hot fat or oil	/fraɪ/	Fry the chicken pieces in a little oil until they are golden brown.	houhai	0
133	Unit 4	Lesson 2	mix	to combine two or more substances or things, usually in a way that means they cannot easily be separated	/mɪks/	Mix the flour and butter together until the mixture is smooth.	houhai	0
134	Unit 4	Lesson 2	slice	to cut something into slices (= thin flat pieces of bread, meat, cheese, etc. that has been cut off a larger piece)	/slaɪs/	She used a sharp knife to slice the bread into even pieces.	houhai	0
135	Unit 4	Lesson 2	dip	to put something quickly into a liquid and take it out again	/dɪp/	He liked to dip his bread into the olive oil before eating it.	houhai	0
136	Unit 4	Lesson 2	dish	the food served in a dish	/dɪʃ/	This noodle dish is a traditional recipe from my grandmother.	houhai	0
137	Unit 4	Lesson 3	chilli pepper (AmE Chili pepper)	the small green or red fruit of a type of pepper plant that is used in cooking to give a hot taste to food, often dried or made into powder	/ˈtʃɪli ˌpepə/	She added a chilli pepper to the stir-fry to give it some heat.	houhai	0
138	Unit 4	Lesson 3	pan	a container, usually made of metal, with a handle or handles, used for cooking food in	/pæn/	Heat the oil in the pan before adding the sliced vegetables.	houhai	0
139	Unit 4	Lesson 3	gently	in a way that is soft and light, not strong, extreme or violent	/ˈdʒentli/	Stir the sauce gently so it doesn't splash out of the pan.	houhai	0
140	Unit 4	Lesson 3	recipe	a set of instructions for making food	/ˈresɪpi/	She followed her grandmother's recipe to make the traditional apple pie.	houhai	0
141	Unit 4	Lesson 3	remove	to take somebody/something away from a place	/rɪˈmuːv/	Remove the pan from the heat once the sauce starts to bubble.	houhai	0
142	Unit 4	Lesson 3	pour	to cause (something) to flow in a steady stream from or into a container or place	/pɔː/	Pour the hot soup carefully into the bowls without spilling it.	houhai	0
143	Unit 4	Lesson 3	serving	an amount of food for one person	/ˈsɜːvɪŋ/	This recipe makes four servings, so it's perfect for a family dinner.	houhai	0
144	Unit 4	Lesson 3	tablespoon	a large spoon, used especially for serving food	/ˈteɪbəlspuːn/	Add two tablespoons of soy sauce to the marinade and stir well.	houhai	0
145	Unit 4	Lesson 3	consume	to eat or drink something	/kənˈsjuːm/	People in some countries consume large amounts of rice every day.	houhai	0
146	Unit 4	Lesson 3	reject	to refuse to accept or consider something	/rɪˈdʒekt/	She decided to reject the spicy dish because she doesn't like hot food.	houhai	0
147	Unit 5	Lesson 1	bell	a hollow, metal object, shaped like a cup, with a metal part inside that hits the side of the cup and makes a ringing sound	/bel/	The bell rang loudly to signal the end of the school lesson.	houhai	0
148	Unit 5	Lesson 1	canteen	a place where food and drink are served in a factory, a school, etc.	/kænˈtiːn/	The students lined up in the canteen to get their lunch.	houhai	0
149	Unit 5	Lesson 1	magazine	a thin book published every week or month, that has shiny, colourful pages with articles and pictures	/ˌmæɡəˈziːn/	She bought a science magazine to read on the train journey.	houhai	0
150	Unit 5	Lesson 1	sweatshirt	a piece of clothing for the upper part of the body, with long sleeves, usually made of thick cotton and often worn for sports	/ˈswetʃɜːt/	He pulled on his favourite sweatshirt before heading out into the cold.	houhai	0
151	Unit 5	Lesson 1	break	a short period of time when you stop what you are doing and rest, eat, etc.	/breɪk/	The students went outside to play during their morning break.	houhai	0
152	Unit 5	Lesson 1	term	(especially in the UK) one of the three periods in the year during which classes are held in schools, universities, etc.	/tɜːm/	The autumn term starts in September and ends just before Christmas.	houhai	0
153	Unit 5	Lesson 1	cheat	to behave in a way that is not honest or fair in order to win something or to get something	/tʃiːt/	The teacher caught him trying to cheat by looking at his classmate's answers.	houhai	0
154	Unit 5	Lesson 1	fair	acceptable and appropriate in a particular situation	/feə/	It's not fair to give some students more time than others in the exam.	houhai	0
155	Unit 5	Lesson 1	head teacher	a teacher who is in charge of a school	/ˈhed ˌtiːtʃə/	The head teacher gave a speech to welcome students on the first day.	houhai	0
156	Unit 5	Lesson 1	strict	A strict person makes sure that children or people working for them behave well and does not allow them to break any rules	/strɪkt/	The strict teacher expected all homework to be handed in on time.	houhai	0
157	Unit 5	Lesson 1	test	a set of questions to measure someone's knowledge or ability	/test/	She studied hard all week to prepare for the maths test on Friday.	houhai	0
158	Unit 5	Lesson 1	fencing	the sport of fighting with long thin swords	/ˈfensɪŋ/	She took up fencing at school and became the regional champion.	houhai	0
159	Unit 5	Lesson 2	exam	an official test of how much you know about something, or how well you can do something	/ɪɡˈzæm/	He revised every evening for weeks before his final science exam.	houhai	0
160	Unit 5	Lesson 2	nature reserve	an area of land where the animals and plants are protected	/ˈneɪtʃə rɪˌzɜːv/	The class visited the nature reserve to study local wildlife.	houhai	0
161	Unit 5	Lesson 2	discuss	to talk about something with somebody, especially in order to decide something	/dɪˈskʌs/	Let's discuss the results of the experiment before writing the report.	houhai	0
162	Unit 5	Lesson 2	friendship	a relationship between friends	/ˈfrendʃɪp/	Their friendship grew stronger after they helped each other through hard times.	houhai	0
163	Unit 5	Lesson 2	in the wild	in nature	/ɪn ðə waɪld/	It's rare to see a snow leopard in the wild in the mountains.	houhai	0
164	Unit 5	Lesson 2	understanding	knowledge about a subject, situation, etc. or about how something works	/ˌʌndəˈstændɪŋ/	Reading widely helps to develop a deeper understanding of different cultures.	houhai	0
165	Unit 5	Lesson 2	boarding school	a school where children can live during the school year	/ˈbɔːdɪŋ skuːl/	He was sent to a boarding school in the countryside at the age of eleven.	houhai	0
166	Unit 5	Lesson 2	education	the process of teaching and learning in a school or college, or the knowledge that you get from this	/ˌedjuˈkeɪʃən/	A good education gives children the skills they need for the future.	houhai	0
167	Unit 5	Lesson 2	marks	numbers or letters that are written on a piece of work, showing how good the work is	/mɑːks/	She got full marks on her English test, which impressed her teacher.	houhai	0
168	Unit 5	Lesson 2	report	something teachers write about a child's progress at school for their parents	/rɪˈpɔːt/	His school report showed that he had improved greatly in mathematics.	houhai	0
169	Unit 5	Lesson 2	time off	time when you are not working or studying	/taɪm ɒf/	The students were given time off to visit the science museum in the city.	houhai	0
170	Unit 5	Lesson 2	natural	existing in nature	/ˈnætʃərəl/	The wooden furniture has a natural beauty that synthetic materials lack.	houhai	0
171	Unit 5	Lesson 2	solve	to find a way to deal with and end (a problem)	/sɒlv/	The detective worked hard to solve the mysterious crime.	houhai	0
172	Unit 5	Lesson 2	path	a track that is made by people or animals walking over the ground	/pɑːθ/	They followed a narrow path through the forest to reach the waterfall.	houhai	0
173	Unit 5	Lesson 2	imagine	to form a picture in your mind of what something might be like	/ɪˈmædʒɪn/	Close your eyes and imagine you're lying on a sunny beach.	houhai	0
174	Unit 5	Lesson 3	interview	to question or talk with (someone) in order to get information or learn about that person	/ˈɪntəvjuː/	She prepared carefully for her interview at the prestigious university.	houhai	0
175	Unit 5	Lesson 3	project	a task or problem in school that requires careful work over a long period of time	/ˈprɒdʒekt/	The students worked together on a science project about climate change.	houhai	0
176	Unit 5	Lesson 3	brilliant	very good	/ˈbrɪliənt/	The young scientist came up with a brilliant solution to the problem.	houhai	0
177	Unit 6	Lesson 1	(catch a) cold	to become ill with a cold	/kætʃ ə kəʊld/	She caught a cold after playing outside in the rain without a coat.	houhai	0
178	Unit 6	Lesson 1	earache	pain inside the ear	/ˈɪəreɪk/	The child complained of an earache and couldn't concentrate in class.	houhai	0
179	Unit 6	Lesson 1	cough	to force air through your throat with a short, loud noise often because you are sick	/kɒf/	He had a bad cough that kept him awake all through the night.	houhai	0
180	Unit 6	Lesson 1	headache	a continuous pain in the head	/ˈhedeɪk/	She took a painkiller to relieve the headache she had had all day.	houhai	0
181	Unit 6	Lesson 1	sneeze	to suddenly force air out through your nose and mouth in a way that you cannot control, for example because you have a cold	/sniːz/	Dusty rooms often make me sneeze repeatedly.	houhai	0
182	Unit 6	Lesson 1	stomach ache (also stomachache)	pain in or near your stomach	/ˈstʌmək eɪk/	He had a stomach ache after eating too much at the birthday party.	houhai	0
183	Unit 6	Lesson 1	ache	a continuous feeling of pain in a part of the body	/eɪk/	After the long run, every muscle in her body seemed to ache.	houhai	0
184	Unit 6	Lesson 1	toothache	a pain in your teeth or in one tooth	/ˈtuːθeɪk/	He visited the dentist because he had been suffering from a terrible toothache.	houhai	0
185	Unit 6	Lesson 1	thermometer	an instrument used for measuring temperature	/θəˈmɒmɪtə/	The nurse used a thermometer to check if the child had a fever.	houhai	0
186	Unit 6	Lesson 1	temperature	the measurement in degrees of how hot or cold a thing or place is	/ˈtempərətʃə/	The doctor said the child had a high temperature and should stay in bed.	houhai	0
187	Unit 6	Lesson 1	ankle	the joint where the foot joins the leg	/ˈæŋkəl/	She twisted her ankle when she stepped off the kerb.	houhai	0
188	Unit 6	Lesson 1	chest	the front part of the body between the neck and the stomach	/tʃest/	He felt a sharp pain in his chest and decided to see a doctor.	houhai	0
191	Unit 6	Lesson 1	shoulder	the part of your body where your arm is connected	/ˈʃəʊldə/	She carried the heavy bag over her shoulder as she walked to school.	houhai	0
192	Unit 6	Lesson 1	stomach	the organ inside the body where food goes when you eat it	/ˈstʌmək/	He felt sick in his stomach after eating something that had gone off.	houhai	0
193	Unit 6	Lesson 1	tail	the part of an animal's body that extends from the animal's back end	/teɪl/	The dog wagged its tail excitedly when it saw its owner come home.	houhai	0
194	Unit 6	Lesson 1	back flip (also backflip)	a type of somersault (= movement in which you turn over completely) which involves turning backwards and landing on your feet	/ˈbæk flɪp/	The gymnast performed a perfect back flip on the mat to great applause.	houhai	0
195	Unit 6	Lesson 1	stump	the bottom part of a tree left in the ground after the rest has fallen or been cut down	/stʌmp/	The difficult maths problem completely stumped even the brightest students.	houhai	0
196	Unit 6	Lesson 1	common	happening often	/ˈkɒmən/	Colds are very common in winter when the weather is cold and damp.	houhai	0
197	Unit 6	Lesson 1	virus	a living thing, too small to be seen without a microscope, that causes disease in people, animals and plants	/ˈvaɪrəs/	The flu is caused by a virus that spreads quickly in cold weather.	houhai	0
198	Unit 6	Lesson 1	throat	the front part of the neck	/θrəʊt/	She had a sore throat and found it difficult to swallow.	houhai	0
199	Unit 6	Lesson 2	bleed	to lose blood, especially from a wound or an injury	/bliːd/	The cut on his finger started to bleed, so he wrapped it in a bandage.	houhai	0
200	Unit 6	Lesson 2	injure	to hurt or cause physical harm to a person or animal	/ˈɪndʒə/	The player was injured during the match and had to leave the field.	houhai	0
201	Unit 6	Lesson 2	lungs	the two organs in the chest that you use for breathing	/lʌŋz/	Smoking can cause serious damage to your lungs over time.	houhai	0
202	Unit 6	Lesson 2	mummy	a dead body of a person or animal prepared for burial in the manner of the ancient Egyptians	/ˈmʌmi/	The ancient Egyptian mummy was discovered in a sealed tomb.	houhai	0
203	Unit 6	Lesson 2	ill	suffering from an illness or disease; not feeling well	/ɪl/	She felt very ill after eating the food that had been left out too long.	houhai	0
204	Unit 6	Lesson 2	weak	not physically strong	/wiːk/	After being ill for a week, he felt too weak to get out of bed.	houhai	0
205	Unit 6	Lesson 2	skin	the layer of tissue that covers the body	/skɪn/	She put on sunscreen to protect her skin from the strong summer sun.	houhai	0
206	Unit 6	Lesson 2	sore	feeling or affected by pain	/sɔː/	Her feet were sore after walking for several hours in new shoes.	houhai	0
207	Unit 6	Lesson 2	tattoo	a picture or word that is drawn on a person's skin by using a needle and ink	/təˈtuː/	The sailor had a tattoo of an anchor on his right arm.	houhai	0
208	Unit 6	Lesson 2	ancient	belonging to a period of history that is thousands of years in the past	/ˈeɪnʃənt/	The ancient ruins were discovered by archaeologists during the excavation.	houhai	0
209	Unit 6	Lesson 2	mystery	something that is difficult to understand or to explain	/ˈmɪstəri/	How the pyramids were built remains a great mystery to this day.	houhai	0
210	Unit 6	Lesson 2	discovery	the act of finding or learning something for the first time	/dɪˈskʌvəri/	The discovery of penicillin was one of the greatest advances in medicine.	houhai	0
211	Unit 6	Lesson 2	arrowhead	the sharp pointed end of an arrow	/ˈærəʊhed/	The archaeologist found a sharp flint arrowhead buried in the ground.	houhai	0
212	Unit 6	Lesson 2	perhaps	maybe	/pəˈhæps/	Perhaps we should leave earlier to avoid the heavy traffic on the motorway.	houhai	0
213	Unit 6	Lesson 3	living	a way or style of life	/ˈlɪvɪŋ/	The scientist studied living organisms under the microscope in the lab.	houhai	0
214	Unit 6	Lesson 3	pollinate	to put pollen into a flower or plant so that it produces seeds	/ˈpɒlɪneɪt/	Bees pollinate flowers as they move from plant to plant collecting nectar.	houhai	0
215	Unit 6	Lesson 3	active	always busy doing things, especially physical activities	/ˈæktɪv/	She is very active in the community, volunteering at the local food bank.	houhai	0
216	Unit 6	Lesson 3	honeycomb	a group of wax cells with six sides that are built by honeybees in their hive and that contain young bees or honey	/ˈhʌnikəʊm/	The beekeeper carefully removed the honeycomb from the hive.	houhai	0
217	Unit 6	Lesson 3	screen	the flat surface at the front of a television, computer, or other electronic device, on which you see pictures or information	/skriːn/	She stared at the screen of her phone, waiting for a message.	houhai	0
218	Unit 6	Lesson 3	beehive	a structure made for bees to live in	/ˈbiːhaɪv/	The farmer placed several beehives at the edge of the orchard.	houhai	0
219	Unit 6	Lesson 3	hydrated	having absorbed enough water or other liquid	/haɪˈdreɪtɪd/	It's important to stay hydrated when exercising in hot weather.	houhai	0
220	Unit 6	Lesson 3	especially	used to indicate something that deserves special mention	/ɪˈspeʃəli/	She loves all kinds of music, especially classical pieces from the Baroque period.	houhai	0
221	Unit 6	Lesson 3	stretch	to put your arms or legs out straight and contract your muscles	/stretʃ/	She likes to stretch her arms and legs for ten minutes every morning.	houhai	0
\.


--
-- Name: vocabulary_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.vocabulary_id_seq', 221, true);


--
-- Name: calc_event_log calc_event_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calc_event_log
    ADD CONSTRAINT calc_event_log_pkey PRIMARY KEY (id);


--
-- Name: calc_level_state calc_level_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calc_level_state
    ADD CONSTRAINT calc_level_state_pkey PRIMARY KEY (user_id, level);


--
-- Name: robot_tasks robot_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.robot_tasks
    ADD CONSTRAINT robot_tasks_pkey PRIMARY KEY (user_id, id);


--
-- Name: vocabulary vocabulary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary
    ADD CONSTRAINT vocabulary_pkey PRIMARY KEY (id);


--
-- Name: calc_event_log_user_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calc_event_log_user_time_idx ON public.calc_event_log USING btree (user_id, occurred_at DESC);


--
-- Name: robot_tasks_user_id_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX robot_tasks_user_id_sort_idx ON public.robot_tasks USING btree (user_id, sort_order);


--
-- Name: calc_event_log calc_event_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calc_event_log
    ADD CONSTRAINT calc_event_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: calc_level_state calc_level_state_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calc_level_state
    ADD CONSTRAINT calc_level_state_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: robot_tasks robot_tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.robot_tasks
    ADD CONSTRAINT robot_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: calc_event_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calc_event_log ENABLE ROW LEVEL SECURITY;

--
-- Name: calc_event_log calc_event_log_modify_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calc_event_log_modify_own ON public.calc_event_log USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: calc_event_log calc_event_log_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calc_event_log_select_own ON public.calc_event_log FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: calc_level_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calc_level_state ENABLE ROW LEVEL SECURITY;

--
-- Name: calc_level_state calc_level_state_modify_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calc_level_state_modify_own ON public.calc_level_state USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: calc_level_state calc_level_state_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calc_level_state_select_own ON public.calc_level_state FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: robot_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.robot_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: robot_tasks users delete own robot_tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users delete own robot_tasks" ON public.robot_tasks FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: robot_tasks users insert own robot_tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users insert own robot_tasks" ON public.robot_tasks FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: robot_tasks users read own robot_tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users read own robot_tasks" ON public.robot_tasks FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: robot_tasks users update own robot_tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users update own robot_tasks" ON public.robot_tasks FOR UPDATE USING ((auth.uid() = user_id));


--
-- PostgreSQL database dump complete
--


